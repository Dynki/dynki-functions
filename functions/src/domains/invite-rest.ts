import { Request, Response } from 'express';
import { firestore } from 'firebase-admin'; 
import { config } from 'firebase-functions';
import { createTransport } from 'nodemailer';
import * as _ from 'lodash';
import newGuid from '../utils/guid';

import { DynRestBase } from '../base/restbase';

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
                const inviteeEmail = req.body.invitee;
                const invitorEmail = req.body.invitor;
                const domainName = req.body.domainName;
        
                const invite: memberInvite = {
                    name: newGuid(),
                    invitee: inviteeEmail,
                    inviter: invitorEmail,
                    uid: null,
                    status: 'pending',
                    domain: req.body.domain,
                    created: new Date(),
                    createdBy: inviteeEmail
                }
        
                await this.addInviteeRecord(invite);
                await this.sendEmail(inviteeEmail, invitorEmail, domainName);
                res.status(200).send('Success');
            } else {
                res.status(401).send('Unauthorised to perform this operation');
            }

        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
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

    async addInviteeRecord(invite: memberInvite): Promise<any> {
        await firestore().collection('member-invites').add(invite);
    }

    async sendEmail(inviteeEmail, invitorEmail, domainName) : Promise<any> {
        const gmailEmail = config().gmail.email;
        const gmailPassword = config().gmail.password;
        const mailTransport = createTransport({
            service: 'gmail',
            auth: {
                user: gmailEmail,
                pass: gmailPassword,
            },
        });            

        const mailOptions = <any> {
            from: '"Dynki" <invitation-do-not-reply@dynki.com>',
            to: inviteeEmail,
        };
        
        // Building Email message.
        mailOptions.subject = `${invitorEmail} invited you to join the team "${domainName}" on Dynki`;
        mailOptions.html = this.getHtmlForEmail();

        await mailTransport.sendMail(mailOptions);
    }

    getHtmlForEmail(): string {
        return `<table cellspacing="0" cellpadding="0" border="0"
        style="color:#333;background:#fff;padding:0;margin:0;width:100%;font:15px 'Helvetica Neue',Arial,Helvetica">
        <tbody>
            <tr width="100%">
                <td valign="top" align="left" style="background:#f0f0f0;font:15px 'Helvetica Neue',Arial,Helvetica">
                    <table style="border:none;padding:0 18px;margin:50px auto;width:500px">
                        <tbody>
    
                            <tr width="100%" height="57">
                                <td valign="top" align="left"
                                    style="border-top-left-radius:4px;border-top-right-radius:4px;background:#0079bf;padding:12px 18px;text-align:center">
    
                                    <img height="37" width="122"
                                        src="https://ci3.googleusercontent.com/proxy/41-uWafMRM7PBe1PYp4PybxExvGLVPW3i1q656Z5_GlXNkupWQqWEO0A-KDCbIPDwmEHUnzZLvGz75kLows3m_9YssRi19a9Hpfy=s0-d-e1-ft#https://trello.com/images/email-header-logo-white-v2.png"
                                        title="Dynki" style="font-weight:bold;font-size:18px;color:#fff;vertical-align:top"> 
                                </td>
                            </tr>
    
                            <tr style="width:100%">
                                <td valign="top" align="left" style="background:#fff;padding:18px">
    
                                    <p
                                        style="color:#333333;font:14px/1.25em 'Helvetica Neue',Arial,Helvetica;font-weight:bold;line-height:20px;text-align:center;padding-left:56px;padding-right:56px">
                                        Hey there! Dean Selvey from Dynk Test has invited you to their team on
                                        Trello<span>.</span> </p>
    
                                    <div
                                        style="background:#fff;border:solid 1px #f0f0f0;margin-left:56px;margin-right:56px;border-radius:3px">
                                        <p
                                            style="color:#333333;line-height:20px;text-align:center;margin:0;font-style:italic;padding-left:24px;padding-right:24px;padding-top:17px;padding-bottom:17px">
                                            "I'd like to invite you to join Dynk Test on Trello<span>.</span> We use Trello
                                            to organize tasks, projects, due dates, and much more<span>.</span>" </p>
                                    </div>
    
                                    <p
                                        style="font:15px/1.25em 'Helvetica Neue',Arial,Helvetica;margin-bottom:0;text-align:center">
                                        <a href="https://trello.com/organizationinvited/5dae0a231de66d7d226992b0/5dae0a6a29dbc85dbacb5264/9d0c841f2b6afd1c94d7f61dcf0b33f1?utm_source=eval-email&amp;utm_medium=email&amp;utm_campaign=team-invite"
                                            style="border-radius:3px;background:#5aac44;color:#fff;display:block;font-weight:600;font-size:20px;line-height:24px;margin:32px auto 24px;padding:11px 13px;text-decoration:none;width:152px"
                                            target="_blank"
                                            data-saferedirecturl="https://www.google.com/url?q=https://trello.com/organizationinvited/5dae0a231de66d7d226992b0/5dae0a6a29dbc85dbacb5264/9d0c841f2b6afd1c94d7f61dcf0b33f1?utm_source%3Deval-email%26utm_medium%3Demail%26utm_campaign%3Dteam-invite&amp;source=gmail&amp;ust=1571773438748000&amp;usg=AFQjCNH__dq9eZEXrYCVAa3q8Wj8kpEYQg">
                                            Join the Team </a> </p>
    
                                    <p
                                        style="font:14px/1.25em 'Helvetica Neue',Arial,Helvetica;color:#838c91;text-align:center;padding-left:56px;padding-right:56px;padding-bottom:8px">
                                        Trello boards help you put your plans into action and achieve your goals. <a
                                            href="http://trello.com" style="color:#0079bf;text-decoration:none"
                                            target="_blank"
                                            data-saferedirecturl="https://www.google.com/url?q=http://trello.com&amp;source=gmail&amp;ust=1571773438748000&amp;usg=AFQjCNEslc12muE6RWfjMsSwLU9ln5N-YA">Learn
                                            more</a> </p>
    
                                    <p
                                        style="color:#333333;font:14px/1.25em 'Helvetica Neue',Arial,Helvetica;text-align:center;padding-left:56px;padding-right:56px;padding-bottom:8px">
                                        <a href="https://trello.com/unsubscribe?idMember=5dae0a6a29dbc85dbacb5264&amp;type=invites&amp;hash=6278a55a635535f9e05f92a7226fca0746aba9c2"
                                            style="color:#0079bf;text-decoration:none;font-weight:bold" target="_blank"
                                            data-saferedirecturl="https://www.google.com/url?q=https://trello.com/unsubscribe?idMember%3D5dae0a6a29dbc85dbacb5264%26type%3Dinvites%26hash%3D6278a55a635535f9e05f92a7226fca0746aba9c2&amp;source=gmail&amp;ust=1571773438748000&amp;usg=AFQjCNHUnaZPbdzt-VZp0Dn0KslxS-h4lw">Unsubscribe
                                            from these emails</a> </p>
                                </td>
                            </tr>
    
                        </tbody>
                    </table>
                </td>
            </tr>
        </tbody>
        </table>`;
    }
}
