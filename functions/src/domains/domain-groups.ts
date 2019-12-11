import { Express, Request, Response, Router } from 'express';
import * as admin from 'firebase-admin'; 

import newGuid from '../utils/guid';
import { DomainRequest } from '../base/dynki-request';
import roles from './roles-enum';

export class DomainGroups {
    router: Router;

    constructor(domainApp: Express) {
        this.router = Router({ mergeParams: true });

        // Create a group on the domain
        this.router.route('/').post(this.postGroup.bind(this));

        // Get all groups on the domain
        this.router.route('/').get(this.getGroups.bind(this));

        // Individual group mapping.
        this.router.route('/:group_id').get(this.returnGroup.bind(this));
        this.router.route('/:group_id').put(this.updateGroup.bind(this));
        this.router.route('/:group_id').delete(this.deleteGroup.bind(this));

        domainApp.param('group_id', this.getGroupId.bind(this));
        domainApp.use('/:id/groups', this.router.bind(this));
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

        const { claims } = <any>req.body.dynki.user.customClaims;
        const { domainId } = <any>req.body.dynki.data.domainId;

        if (!claims.domainIds || !claims.domainIds[domainId] || !claims.domainIds[domainId].roles) {
            return false;
        }

        return claims.domainIds[domainId].roles.includes(roles.Administrators);
    }

    private isGroupAllowed(groupName: string) :Boolean {
        const name = groupName.toLocaleUpperCase();
        const groupsNotAllowed = [
            roles.Administrators.toLocaleUpperCase(), 
            roles.BoardCreators.toLocaleUpperCase(), 
            roles.BoardUsers.toLocaleUpperCase()
        ];

        return groupsNotAllowed.includes(name) === false;
    }

    /**
     * Domain Group methods
     */

     async getGroupId(req: DomainRequest, res: Response, next, id) {
        try {
            req.body.dynki.data.groupId = id;
            req.body.dynki.data.group = req.body.dynki.data.domainRawRecord.groups.find(g => g.id === id);
            next();
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async getGroups(req: DomainRequest, res: Response) {
        try {
            res.json(req.body.dynki.data.domainRawRecord.groups);
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async returnGroup(req: DomainRequest, res: Response) {
        try {
            res.json(req.body.dynki.data.group);
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async postGroup(req: DomainRequest, res: Response) {
        try {
            if (this.isAdmin(req)) {
                const { group_name } = req.body;
                const { data, user } = req.body.dynki;
                const domainData = data.domainRawRecord;
                const domainGroups = domainData.groups ? domainData.groups : [];

                // Not allowed to add group with name "ADMINISTRATORS", "BOARD_CREATORS", "BOARD_USERS"
                if (!this.isGroupAllowed(group_name)) {
                    res.status(403).send({ error: `Cannot add a group with the name ${group_name}` });
                } else {
                    const newGroup = { id: newGuid(), name: group_name, members: [user.uid] }
                    const mergedGroups = [...domainGroups, newGroup];
    
                    await admin.firestore().collection('user-domains').doc(data.domainId).update({ 
                        groups: mergedGroups
                    });
    
                    res.json(newGroup);
                }
            } else {
                res.status(401).send('Unauthorised to perform this operation');
            }

        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async updateGroup(req: DomainRequest, res: Response) {
        try {

            if (this.isAdmin(req)) {
                const { domainId, domainRawRecord } = req.body.dynki.data;
                const { group_name } = req.body;

                // Not allowed to update group with name "ADMINISTRATORS", "BOARD_CREATORS", "BOARD_USERS"
                if (!this.isGroupAllowed(group_name)) {
                    res.status(403).send({ error: 'Cannot update this group' });
                } else {
                    const domainGroups = domainRawRecord.groups.map(g => {
                        if (g.id === req.params.group_id) {
                            g.name = group_name;
                        }
                        return g;
                    });

                    await admin.firestore().collection('user-domains').doc(domainId).update({ 
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

    async deleteGroup(req: DomainRequest, res: Response) {
        try {
            if (this.isAdmin(req)) {
                const { domainId, domainRawRecord, group } = req.body.dynki.data;

                // Not allowed to delete group with name "ADMINISTRATORS", "BOARD_CREATORS", "BOARD_USERS"
                if (!this.isGroupAllowed(group.name)) {
                    res.status(403).send({ error: 'Cannot delete this group' });
                } else {
                    const domainGroups = domainRawRecord.groups.filter(g => {
                        return g.id !== req.params.group_id;
                    });

                    const domainMembers = domainRawRecord.members.map(m=> {
                        m.memberOf = m.memberOf.filter(grp => grp !== req.params.group_id);
                        return m;
                    })

                    await admin.firestore().collection('user-domains').doc(domainId).update({ 
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
}
