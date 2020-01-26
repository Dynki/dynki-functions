import { Express, Response, Router } from 'express';
import * as admin from 'firebase-admin'; 

import { DomainRequest } from '../base/dynki-request';
import roles from './roles-enum';
import SubscriptionHelper from '../subscriptions/SubscriptionHelper';

export class DomainMembers {
    router: Router;
    helper: SubscriptionHelper;

    constructor(domainApp: Express) {
        this.router = Router({ mergeParams: true });
        this.helper = new SubscriptionHelper();

        // Get all members on the domain
        this.router.route('/').get(this.getMembers.bind(this));

        // Individual member mapping.
        this.router.route('/:member_id').get(this.returnMember.bind(this));
        this.router.route('/:member_id').put(this.updateMember.bind(this));
        this.router.route('/:member_id').delete(this.deleteMember.bind(this));

        domainApp.param('member_id', this.getMemberId.bind(this));
        domainApp.use('/:id/members', this.router.bind(this));
    }

    private isAdmin = (req: DomainRequest) : boolean => {

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
        const { domainId } = <any>req.body.dynki.data;

        if (!customClaims.domainIds || !customClaims.domainIds[domainId] || !customClaims.domainIds[domainId].roles) {
            return false;
        }

        return customClaims.domainIds[domainId].roles.includes(roles.Administrators);
    }

    /**
     * Domain Member methods
     */
    
    async getMemberId(req: DomainRequest, res: Response, next, id) {
        try {
            req.body.dynki.data.member = req.body.dynki.data.domainRawRecord.members.find(g => g.id === id);
            req.body.dynki.data.memberId = id;
            next();
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async getMembers(req: DomainRequest, res: Response) {
        try {
            res.json(req.body.dynki.data.domainRawRecord.members);
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async returnMember(req: DomainRequest, res: Response) {
        try {
            res.json(req.body.dynki.data.member);
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async deleteMember(req: DomainRequest, res: Response) {
        try {
            if (this.isAdmin(req)) {

                const domainData = req.body.dynki.data.domainRawRecord;
                const memberId = req.params.member_id;
                const memberToDelete = domainData.members.find(g => g.id === memberId);
                
                if (memberToDelete) {

                        const containsAdminGroup = memberToDelete.memberOf.indexOf(roles.Administrators) > -1;
                        const user = await admin.auth().getUser(memberToDelete.uid);
        
                        const isOwner = memberToDelete.uid === domainData.owner;

                        // Cannot remove the domain owner from the "ADMINSTRATORS" group.
                        if (isOwner) {
                            res.status(403).send({ error: 'Cannot remove this member from Administrators group' });
                        } else {

                            if (domainData.members.find(m => m.uid === user.uid)) {
        
                                const domainMembers = domainData.members.filter(m => m.uid !== user.uid);
                
                                const { customClaims } = <any>user;
                                const { domainId } = req.body.dynki.data;
            
                                await admin.firestore().collection('user-domains').doc(domainId).update({ 
                                    members: domainMembers
                                });
            
                                delete customClaims.domainIds[domainId];
            
                                await admin.auth().setCustomUserClaims(user.uid, 
                                    { 
                                        domainId: customClaims.domainId,
                                        domainIds: customClaims.domainIds 
                                    }
                                );
            
                                await this.helper.decreaseSubscriptionQuantity(domainId);
                
                                res.sendStatus(200);
                            } else {
                                res.status(404).send({ error: 'Member not attached to this domain' });                                
                            }
                        }
                } else {
                    res.status(404).send({ error: `Could not locate member id (${memberId}) in domain` });                                
                }

            } else {
                res.status(401).send({ error: 'Unauthorised to perform this operation' });
            }
        } catch (error) {
            console.log(error);
            res.status(500).send({ error: req.body.log });
        }
    }

    async updateMember(req: DomainRequest, res: Response) {
        try {
            if (this.isAdmin(req)) {

                const domainData = req.body.dynki.data.domainRawRecord;
                const memberToUpdate = domainData.members.find(m => m.uid === req.params.member_id);
                const containsAdminGroup = req.body.memberOf.indexOf(roles.Administrators) > -1;

                const user = await admin.auth().getUser(memberToUpdate.uid);

                // Cannot remove the domain owner from the "ADMINSTRATORS" group.
                if (memberToUpdate.uid === domainData.owner && req.body.memberOf && !containsAdminGroup) {
                    res.status(403).send({ error: 'Cannot remove this member from Administrators group' });
                } else {
                    const domainMembers = domainData.members.map(m => {

                        if (m.uid === req.params.member_id) {
                            if (req.body.memberOf) {
                                m.memberOf = req.body.memberOf;
                            }
        
                            if (req.body.status) {
                                m.status = req.body.status
                            }
                        }
    
                        return m;
                    });
    
                    const { customClaims } = <any>user;
                    const { domainId } = req.body.dynki.data;

                    await admin.firestore().collection('user-domains').doc(domainId).update({ 
                        members: domainMembers
                    });

                    customClaims.domainIds[domainId].roles = req.body.memberOf;

                    await admin.auth().setCustomUserClaims(user.uid, 
                        { 
                            domainId: customClaims.domainId,
                            domainIds: customClaims.domainIds 
                        }
                    );
    
                    res.sendStatus(200);
                }
            } else {
                res.status(401).send({ error: 'Unauthorised to perform this operation' });
            }
        } catch (error) {
            console.log(error);
            res.status(500).send({ error: req.body.log });
        }
    }
}
