import { Express, Request, Response, Router } from 'express';
import { firestore, auth } from 'firebase-admin'; 
import { config } from 'firebase-functions';
import { UserRecord } from 'firebase-functions/lib/providers/auth';
import * as _ from 'lodash';
import * as sgMail from '@sendgrid/mail';
import { MailData } from '@sendgrid/helpers/classes/mail';

import newGuid from '../utils/guid';
import roles from './roles-enum';
import { DynRestBase } from '../base/restbase';
import { DomainRequest } from '../base/dynki-request';

interface memberInvite {
    name: string;
    invitee: string;
    inviter: string;
    uid: string;
    status: string;
    domain: string;
    created: Date;
    createdBy: string;
}

export class InviteRest extends DynRestBase {

    constructor(public domainApp: Express) {
        super(domainApp);

        /**
         * accept
         */
        this.addAcceptRouter();

    }

    private isAdmin = (req: DomainRequest, domainId: string) : boolean => {

        // How to check if someone is an admin?

        // First we need to obtain the user's custom claims. 
        // This can be accessed from the req.body.dynki.user.customClaims object
        
        // Within the custom claims is the domainIds object. Each key in the object is the id of a domain.
        // The value part of each domain is an object containing roles.
        // E.g. domainIds: { rtJT7LAZP4HLrBbNWo1T: { roles: ["ADMINISTRATORS", "BOARD_USERS", "BOARD_CREATORS"] } }

        // We now just need to check if the user has the "ADMINISTRATORS" role for the domain ID we are
        // currently dealing with. The domain ID should already have been populated (via Express routing)
        // and should be on the req.body.dynki.data.domainId property.

        const { customClaims } = <any>req.body.dynki.user;

        if (!customClaims.domainIds || !customClaims.domainIds[domainId] || !customClaims.domainIds[domainId].roles) {
            return false;
        }

        return customClaims.domainIds[domainId].roles.includes(roles.Administrators);
    }

    addAcceptRouter() {
        const acceptRouter = Router({ mergeParams: true });

        // Create a group on the domain
        acceptRouter.route('/').post(this.acceptInvite.bind(this));

        this.domainApp.use('/:id/accept', acceptRouter);
    }

    async acceptInvite(req: Request, res: Response) {
        try {

            // Get the invite record.
            const inviteRecord = await firestore()
                .collection('member-invites')
                .doc(req.body.id)
                .get();

            const inviteData = inviteRecord.data();

            const user: UserRecord = req.body.dynki.user;

            // Check that the invite is in a pending state.
            if (inviteData.status === 'pending') {

                // Add the user UID to the invite record.
                // Update the status to accepted.
                await firestore().collection('member-invites').doc(req.body.id).update({ 
                    uid: user.uid,
                    status: 'accepted'
                });

                await firestore()
                    .collection('user-domains')
                    .doc(inviteData.domain)
                    .get();
                
                await firestore()
                    .collection('user-domains')
                    .doc(inviteData.domain)
                    .update({ 
                        users: firestore.FieldValue.arrayUnion(user.uid),
                        members: firestore.FieldValue.arrayUnion({
                            email: user.email,
                            id: newGuid(),
                            memberOf: [roles.BoardUsers, roles.BoardCreators],
                            status: 'Active',
                            uid: user.uid
                        })
                     });

                const claims = <any> user.customClaims;
                const primaryDomain = claims.domainId;
                const currentDomainIds = claims.domainIds ? claims.domainIds : [];
                const userRoles = [roles.BoardUsers, roles.BoardCreators];

                const domainIds = {...currentDomainIds, ...{ [inviteData.domain] : { roles: userRoles } } };
                await auth().setCustomUserClaims(user.uid, { domainId: primaryDomain, domainIds });

                res.sendStatus(200);
            } else {
                res.status(401).send();
            }
        } catch (error) {
            console.log(error);
            res.status(500).send({ error: req.body.log });
        }
    }

    async getId(req: Request, res: Response, next, id) {
        req.body.id = id;
        next();
    }

    async post(req: Request, res: Response) {
        try {
            const userAllowed = await this.isAdmin(req, req.body.domain);

            if (userAllowed) {
                if (this.requestValid(req)) {
                    const invitees = req.body.invitees;
                    const inviter = req.body.inviter;
                    const teamId = req.body.domain;
                    const teamName = req.body.domainName;
    
                    await this.sendInvites(invitees, inviter, teamId, teamName);
                    res.status(200).send('Success');
                } else {
                    res.status(400).send('Invalid request data');
                }
            } else {
                res.status(401).send('Unauthorised to perform this operation');
            }

        } catch (error) {
            console.log(error);
            res.status(500).send(error);
        }
    }

    requestValid(req: Request) {
        const invitees = req.body.invitees;
        const inviter = req.body.inviter;
        const teamId = req.body.domain;
        const teamName = req.body.domainName;

        return invitees && inviter && teamId && teamName;
    }

    sendInvites(invitees: string[], inviter, teamId, teamName): Promise<any> {
        return Promise.all(
            invitees.map(async (invitee) => {
                const inviteId = newGuid();

                const invite: memberInvite = {
                    name: teamName,
                    invitee,
                    inviter,
                    uid: null,
                    status: 'pending',
                    domain: teamId,
                    created: new Date(),
                    createdBy: inviter
                }
        
                await this.addInviteeRecord(inviteId, invite);
                await this.sendEmail(inviteId, invitee, inviter, teamName);
            })
        );
    }

    async addInviteeRecord(inviteId: string, invite: memberInvite): Promise<any> {
        await firestore().collection('member-invites').doc(inviteId).set(invite);
    }

    async sendEmail(inviteId: string, invitee: string, inviter: string, teamName: string) : Promise<any> {

        sgMail.setApiKey(config().sendgrid.emailkey);

        const msg: MailData = {
            to: invitee,
            from: 'invitation-do-not-reply@dynki.com',
            templateId: config().sendgrid.invitetemplate,
            dynamicTemplateData: {
                inviteId,
                invitee,
                inviter,
                teamName
            }
        }

        await sgMail.send(msg);
    }
}
