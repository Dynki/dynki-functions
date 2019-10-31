import { Request, Response } from 'express';
import { firestore } from 'firebase-admin'; 
import { config } from 'firebase-functions';
import * as _ from 'lodash';
import newGuid from '../utils/guid';
import * as sgMail from '@sendgrid/mail';
import { MailData } from '@sendgrid/helpers/classes/mail';

import { DynRestBase } from '../base/restbase';
import { request } from 'http';

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

    async post(req: Request, res: Response) {
        try {
            const userAllowed = await this.validateUserIsDomainAdmin(req, req.body.domain);

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
                    name: newGuid(),
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

    async validateUserIsDomainAdmin(req: Request, domainId: string): Promise<boolean> {
        const domainCollection = await firestore()
        .collection('user-domains')
        .where(firestore.FieldPath.documentId(), '==', domainId)
        .where('users', 'array-contains', req.body.hiddenUid)
        .get();

        if (domainCollection && domainCollection.docs.length > 0) {
            const retrievedData = domainCollection.docs[0].data();

            const memberRecord = retrievedData.members.find(m => m.uid === req.body.hiddenUid);
            const adminGroupId = retrievedData.groups.find(g => g.name === 'Administrators');
            const isAnAdmin = memberRecord && memberRecord.memberOf.indexOf(adminGroupId.id) > -1;

            return isAnAdmin;
        } else {
            return false;
        } 
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
