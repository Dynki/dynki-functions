import { Express, Request, Response, Router } from 'express';
import * as admin from 'firebase-admin'; 

import newGuid from '../utils/guid';
// import { DynkiRequest } from '../base/dynki-request';
import roles from './roles-enum';

export class DomainMembers {
    router: Router;

    // constructor(domainApp: Express) {
    //     this.router = Router({ mergeParams: true });

    //     // Create a member on the domain
    //     this.router.route('/').post(this.postMember.bind(this))

    //     // Get all members on the domain
    //     this.router.route('/').get(this.getMembers.bind(this));

    //     // Individual member mapping.
    //     this.router.route('/:member_id').get(this.returnMember.bind(this));
    //     this.router.route('/:member_id').put(this.updateMember.bind(this));
    //     this.router.route('/:member_id').delete(this.deleteMember.bind(this));

    //     domainApp.param('member_id', this.getMemberId.bind(this));
    //     domainApp.use('/:id/members', this.router.bind(this));
    // }

    //     /**
    //  * Domain Member methods
    //  */
    
    // async getMemberId(req: Request, res: Response, next, id) {
    //     try {
    //         req.body.dynki.data.member = req.body.dynki.data.domainRawRecord.members.find(g => g.id === id);
    //         next();
    //     } catch (error) {
    //         console.log(error);
    //         res.status(500).send({ error });
    //     }
    // }

    // async getMembers(req: Request, res: Response) {
    //     try {
    //         res.json(req.body.dynki.data.domainRawRecord.members);
    //     } catch (error) {
    //         console.log(error);
    //         res.status(500).send({ error });
    //     }
    // }

    // async returnMember(req: Request, res: Response) {
    //     try {
    //         res.json(req.body.dynki.data.member);
    //     } catch (error) {
    //         console.log(error);
    //         res.status(500).send({ error });
    //     }
    // }

    // async postMember(req: Request, res: Response) {
    //     try {

    //         if (this.isAdmin(req)) {
    //             const { user } = <DynkiRequest>req.body.dynki;
    //             const { domainId, domainRawRecord } = req.body.dynki.data.domainRawRecord;
    //             const { email } = req.body;
    //             const domainMembers = domainRawRecord.members ? domainRawRecord.members : [];
    //             const usersGroupId = domainRawRecord.groups.find(g => g.name === 'Users');
    //             const newMember = { 
    //                 id: newGuid(),
    //                 uid: undefined,
    //                 email, 
    //                 status: 'Pending', 
    //                 memberOf: [usersGroupId.id] 
    //             }
    
    //             const mergedMembers = [...domainMembers, newMember];
    
    //             await admin.firestore().collection('user-domains').doc(domainId).update({ 
    //                 members: mergedMembers
    //             });

    //             const claims = user.customClaims;
    //             const roles = claims.roles ? ['BOARD_USERS', ...claims.roles] : ['BOARD_USERS'];

    //             await admin.auth().setCustomUserClaims(user.uid, { roles });
    
    //             res.json(newMember);
    //         } else {
    //             res.status(401).send('Unauthorised to perform this operation');
    //         }

    //     } catch (error) {
    //         console.log(error);
    //         res.status(500).send({ error: req.body.log });
    //     }
    // }

    // async updateMember(req: Request, res: Response) {
    //     try {
    //         if (this.isAdmin(req)) {

    //             const domainData = req.body.rawRecord;
    //             const memberToUpdate = domainData.members.find(m => m.uid === req.params.member_id);
    //             const containsAdminGroup = req.body.memberOf.indexOf(roles.Administrators) > -1;

    //             if (memberToUpdate.uid === domainData.owner && req.body.memberOf && !containsAdminGroup) {
    //                 res.status(403).send('Cannot remove this member from Administrators group');
    //             } else {
    //                 const domainMembers = domainData.members.map(m => {

    //                     if (m.uid === req.params.member_id) {
    //                         if (req.body.memberOf) {
    //                             m.memberOf = req.body.memberOf;
    //                         }
        
    //                         if (req.body.status) {
    //                             m.status = req.body.status
    //                         }
    //                     }
    
    //                     return m;
    //                 });
    
    //                 await admin.firestore().collection('user-domains').doc(req.body.recordId).update({ 
    //                     members: domainMembers
    //                 });

    //                 const user = req.body.user;
    //                 const claims = user.customClaims;
    //                 const roles = claims.roles ? [req.body.memberOf, ...claims.roles] : [req.body.memberOf];
    
    //                 await admin.auth().setCustomUserClaims(user.uid, { roles });
    
    //                 res.sendStatus(200);
    //             }

    //         } else {
    //             res.status(401).send('Unauthorised to perform this operation');
    //         }

    //     } catch (error) {
    //         console.log(error);
    //         res.status(500).send({ error: req.body.log });
    //     }
    // }

    // async deleteMember(req: Request, res: Response) {
    //     try {
    //         if (this.isAdmin(req)) {

    //             const domainData = req.body.dynki.data.domainRawRecord;
    //             const groupsNotAllowed = ['ADMINISTRATORS', 'BOARD_CREATORS', 'BOARD_USERS'];

    //             if (groupsNotAllowed.indexOf(req.params.group_id) > -1) {
    //                 res.status(403).send({ error: 'Cannot remove member from this group' });
    //             } else {
    
    //                 const domainGroups = domainData.groups.filter(g => {
    //                     return g.id !== req.body.group.id;
    //                 })
        
    //                 await admin.firestore().collection('user-domains').doc(req.body.dynki.data.domainId).update({ 
    //                     groups: domainGroups
    //                 });

    //                 const user = req.body.user;
    //                 const claims = user.customClaims;
    //                 const roles = claims.roles ? claims.roles.filter(r => r !== req.body.group.id) : [];
    
    //                 await admin.auth().setCustomUserClaims(user.uid, { roles });
                    
    //                 res.sendStatus(200);
    //             }

    //         } else {
    //             res.status(401).send('Unauthorised to perform this operation');
    //         }
    //     } catch (error) {
    //         console.log(error);
    //         res.status(500).send({ error: req.body.log });
    //     }
    // }

}
