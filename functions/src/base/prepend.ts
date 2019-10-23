import { Request, Response } from 'express';

export function prepend(req: Request, res: Response, next: any) {
    if (!req.path) {
      req.url = `/${req.url}/` // prepend '/' to keep query params if any
    }
    next();
}

