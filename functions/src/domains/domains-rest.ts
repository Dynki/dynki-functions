import { Express, Request, Response, Router } from 'express';
import * as admin from 'firebase-admin'; 
import * as _ from 'lodash';
import newGuid from '../utils/guid';

import { DynRestBase } from '../base/restbase';

export class DomainRest extends DynRestBase {
    constructor(public domainApp: Express) {
        super(domainApp);

        /**
         * Groups
         */
        this.addGroupsRouter();

        /**
         * Members
         */
        this.addMembersRouter();
    }

    addGroupsRouter() {
        const groupsRouter = Router({ mergeParams: true });

        // Create a group on the domain
        groupsRouter.route('/').post(this.postGroup.bind(this));

        // Get all groups on the domain
        groupsRouter.route('/').get(this.getGroups.bind(this));

        // Individual group mapping.
        groupsRouter.route('/:group_id').get(this.returnGroup.bind(this));
        groupsRouter.route('/:group_id').put(this.updateGroup.bind(this));
        groupsRouter.route('/:group_id').delete(this.deleteGroup.bind(this));

        this.domainApp.param('group_id', this.getGroupId);
        this.domainApp.use('/:id/groups', groupsRouter);

    }

    addMembersRouter() {
        const membersRouter = Router({ mergeParams: true });

        // Create a member on the domain
        membersRouter.route('/').post(this.postMember.bind(this))

        // Get all members on the domain
        membersRouter.route('/').get(this.getMembers.bind(this));

        // Individual member mapping.
        membersRouter.route('/:member_id').get(this.returnMember.bind(this));
        membersRouter.route('/:member_id').put(this.updateMember.bind(this));
        membersRouter.route('/:member_id').delete(this.deleteMember.bind(this));

        this.domainApp.param('member_id', this.getMemberId.bind(this));
        this.domainApp.use('/:id/members', membersRouter);
    }

    isAdmin = (req: Request) : boolean => {
        const memberRecord = req.body.rawRecord.members.find(m => m.uid === req.body.hiddenUid);
        const adminGroupId = req.body.rawRecord.groups.find(g => g.name === 'Administrators');
        const isAnAdmin = memberRecord && memberRecord.memberOf.indexOf(adminGroupId.id) > -1;
        return isAnAdmin;
    }

    /**
     * Domain methods
     */

    async get(req: Request, res: Response) {
        try {
            const domainCollection = await admin.firestore()
                .collection('user-domains').where('users', 'array-contains', req.body.hiddenUid).get();

            if (domainCollection && domainCollection.docs.length > 0) {
                const domains = domainCollection.docs.map(d => {
                    return { id: d.id, display_name: d.data().display_name  }
                });

                res.json(domains);
            } else {
                res.status(404).send();
            } 
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async getId(req: Request, res: Response, next, id) {
        try {
            const domainCollection = await admin.firestore()
                .collection('user-domains')
                .where(admin.firestore.FieldPath.documentId(), '==', id)
                .where('users', 'array-contains', req.body.hiddenUid)
                .get();

            if (domainCollection && domainCollection.docs.length > 0) {
                const retrievedData = domainCollection.docs[0].data();

                const mappedDomain = {
                    id: domainCollection.docs[0].id,
                    display_name: retrievedData.display_name,
                    status: 'Enabled',
                    groups: retrievedData.groups ? retrievedData.groups : [],
                    members: retrievedData.members ? retrievedData.members : []
                }

                req.body.record = mappedDomain;
                req.body.recordId = domainCollection.docs[0].id;
                req.body.rawRecord = domainCollection.docs[0].data();
                next();
                
            } else {
                res.status(404).send();
            } 
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async returnId(req: Request, res: Response) {
        try {
            res.json(req.body.record);
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async post(req: Request, res: Response) {
        try {

            const domainRecord = {
                name: newGuid(),
                display_name: req.body.name,
                owner: req.body.hiddenUid,
                admins: [req.body.hiddenUid],
                users: [req.body.hiddenUid],
                groups: [
                    { id: 'ADMINISTRATORS', name: 'Administrators', members: [req.body.hiddenUid] },
                    { id: 'BOARD_USERS', name: 'Board Users', members: [req.body.hiddenUid] },
                    { id: 'BOARD_CREATORS', name: 'Board Creators', members: [req.body.hiddenUid] }
                ],
                members: [
                    { id: newGuid(), uid: req.body.hiddenUid, email: req.body.email, status: 'Active', memberOf: ['ADMINISTRATORS', 'BOARD_USERS', 'BOARD_CREATORS'] }
                ]
            }

            const docRef = await admin.firestore().collection('user-domains').add(domainRecord);
            const doc = await admin.firestore().collection('user-domains').doc(docRef.id).get();
            await admin.firestore().collection('domains').doc(docRef.id).set({display_name: req.body.name});
            admin.firestore().collection('domains').doc(docRef.id).collection('users').doc(req.body.hiddenUid).set({
                email: req.body.email,
                displayName: req.body.displayName,
            });
            
            admin.firestore()
            .collection('domains')
            .doc(docRef.id)
            .collection('users')
            .doc(req.body.hiddenUid)
            .collection('messages')
            .doc('initial')
            .set({
                id: 'initial',
                from: 'Dynki Team',
                to: [req.body.email],
                subject: 'Welcome to Dynki',
                body: {
                    ops: [
                    { insert: 'Hi, \n\n' +
                    'Thanks for choosing to give us a try. \n' +
                    'You can now start creating boards. \n\n' +
                    'Once again thanks for choosing us. \n\n' +
                    'Regards \n' },
                    { insert: 'Team Dynki', attributes: { bold: true } }
                ]},
                sent: true,
                created: new Date(),
                author: 'Dynki Team',
                status: 'Unread',
                read: false,
                reading: false,
                selected: false
            });

            await admin.auth().setCustomUserClaims(req.body.hiddenUid, { domainId: docRef.id, domainIds: [docRef.id] });

            res.json({ id: doc.data().id });
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    /**
     * Domain Group methods
     */

    async getGroups(req: Request, res: Response) {
        try {
            res.json(req.body.rawRecord.groups);
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async getGroupId(req: Request, res: Response, next, id) {
        try {
            req.body.groupId = id;
            req.body.group = req.body.rawRecord.groups.find(g => g.id === id);
            next();
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async returnGroup(req: Request, res: Response) {
        try {
            res.json(req.body.group);
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async postGroup(req: Request, res: Response) {
        try {
            if (this.isAdmin(req)) {
                const domainData = req.body.rawRecord;
                const domainGroups = domainData.groups ? domainData.groups : [];
                const newGroup = { id: newGuid(), name: req.body.group_name, members: [req.headers.uid] }
                const mergedGroups = [...domainGroups, newGroup];

                const doc = await admin.firestore().collection('user-domains').doc(req.body.recordId).update({ 
                    groups: mergedGroups
                });

                res.json(newGroup);
            } else {
                res.status(401).send('Unauthorised to perform this operation');
            }

        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async updateGroup(req: Request, res: Response) {
        try {

            if (this.isAdmin(req)) {
                const domainData = req.body.rawRecord;
                const groupToUpdate = domainData.groups.find(g => g.id === req.params.group_id);

                if (groupToUpdate.name === 'Administrators' || groupToUpdate.name === 'Users') {
                    res.status(403).send({ error: 'Cannot update this group' });
                } else {
                    const domainGroups = domainData.groups.map(g => {
                        if (g.id === req.params.group_id) {
                            g.name = req.body.group_name;
                        }
                        return g;
                    });

                    const doc = await admin.firestore().collection('user-domains').doc(req.body.recordId).update({ 
                        groups: domainGroups
                    });

                    res.sendStatus(200);
                }

            } else {
                res.status(401).send('Unauthorised to perform this operation');
            }

        } catch (error) {
            console.log(error);
            res.status(500).send({ error: req.body.log });
        }
    }

    async deleteGroup(req: Request, res: Response) {
        try {
            if (this.isAdmin(req)) {
                const domainData = req.body.rawRecord;
                const groupToDelete = domainData.groups.find(g => g.id === req.params.group_id);

                if (groupToDelete.name === 'Administrators' || groupToDelete.name === 'Users') {
                    res.status(403).send({ error: 'Cannot delete this group' });
                } else {
                    const domainGroups = domainData.groups.filter(g => {
                        return g.id !== req.params.group_id;
                    });

                    const domainMembers = domainData.members.map(m=> {
                        m.memberOf = m.memberOf.filter(grp => grp !== groupToDelete.id);
                        return m;
                    })

                        const doc = await admin.firestore().collection('user-domains').doc(req.body.recordId).update({ 
                        groups: domainGroups,
                        members: domainMembers
                    });
        
                    res.sendStatus(200);
                }
            } else {
                res.status(401).send('Unauthorised to perform this operation');
            }
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    /**
     * Domain Member methods
     */

    async getMembers(req: Request, res: Response) {
        try {
            res.json(req.body.rawRecord.members);
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async getMemberId(req: Request, res: Response, next, id) {
        try {
            req.body.member = req.body.rawRecord.members.find(g => g.id === id);
            next();
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async returnMember(req: Request, res: Response) {
        try {
            res.json(req.body.member);
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async postMember(req: Request, res: Response) {
        try {

            if (this.isAdmin(req)) {
                const domainData = req.body.rawRecord;
                const domainMembers = domainData.members ? domainData.members : [];
                const usersGroupId = domainData.groups.find(g => g.name === 'Users');
                const newMember = { id: newGuid(), uid: undefined, email: req.body.email, status: 'Pending', memberOf: [usersGroupId.id] }
    
                const mergedMembers = [...domainMembers, newMember];
    
                await admin.firestore().collection('user-domains').doc(req.body.recordId).update({ 
                    members: mergedMembers
                });

                const user = req.body.user;
                const claims = <any> user.customClaims;
                const roles = claims.roles ? [usersGroupId.id, ...claims.roles] : [usersGroupId.id];

                await admin.auth().setCustomUserClaims(user.uid, { roles });
    
                res.json(newMember);
            } else {
                res.status(401).send('Unauthorised to perform this operation');
            }

        } catch (error) {
            console.log(error);
            res.status(500).send({ error: req.body.log });
        }
    }

    async updateMember(req: Request, res: Response) {
        try {
            if (this.isAdmin(req)) {

                const domainData = req.body.rawRecord;
                const memberToUpdate = domainData.members.find(m => m.uid === req.params.member_id);
                const adminGroupId = domainData.groups.find(g => g.name === 'Administrators');
                const containsAdminGroup = req.body.memberOf.indexOf(adminGroupId.id) > -1;

                if (memberToUpdate.uid === req.body.rawRecord.owner && req.body.memberOf && !containsAdminGroup) {
                    res.status(403).send('Cannot remove this member from Administrators group');
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
    
                    await admin.firestore().collection('user-domains').doc(req.body.recordId).update({ 
                        members: domainMembers
                    });

                    const user = req.body.user;
                    const claims = <any> user.customClaims;
                    const roles = claims.roles ? [req.body.memberOf, ...claims.roles] : [req.body.memberOf];
    
                    await admin.auth().setCustomUserClaims(user.uid, { roles });
    
                    res.sendStatus(200);
                }

            } else {
                res.status(401).send('Unauthorised to perform this operation');
            }

        } catch (error) {
            console.log(error);
            res.status(500).send({ error: req.body.log });
        }
    }

    async deleteMember(req: Request, res: Response) {
        try {
            if (this.isAdmin(req)) {

                const domainData = req.body.rawRecord;
                const groupToDelete = domainData.groups.find(g => g.id === req.body.group.id);
    
                if (groupToDelete.group_name === 'Administrators' || groupToDelete.group_name === 'Users') {
                    res.status(403).send({ error: 'Cannot remove member from this group' });
                } else {
    
                    const domainGroups = domainData.groups.filter(g => {
                        return g.id !== req.body.group.id;
                    })
        
                    await admin.firestore().collection('user-domains').doc(req.body.recordId).update({ 
                        groups: domainGroups
                    });

                    const user = req.body.user;
                    const claims = <any> user.customClaims;
                    const roles = claims.roles ? claims.roles.filter(r => r !== req.body.group.id) : [];
    
                    await admin.auth().setCustomUserClaims(user.uid, { roles });
    
        
                    res.sendStatus(200);
                }

            } else {
                res.status(401).send('Unauthorised to perform this operation');
            }
        } catch (error) {
            console.log(error);
            res.status(500).send({ error: req.body.log });
        }
    }
}
