import { Request, Response } from 'express';

export function prepend(req: Request, res: Response, next: any) {
    console.log('Prepend::Start');
    if (!req.path) {
      req.url = `/${req.url}/` // prepend '/' to keep query params if any

      console.log('Prepend::req.url::', req.url);
    }
    console.log('Prepend::Next::', req);
    next();
}

