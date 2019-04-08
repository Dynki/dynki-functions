import { Express, Request, Response } from 'express';

export interface RestBase {
    get(req: Request, res: Response): void;
    getId(req: Request, res: Response, next: any, id: any): void;
    post(req: Request, res: Response): void;
    put(req: Request, res: Response): void;
    delete(req: Request, res: Response): void;
    notFound(req: Request, res: Response, payload: any): void;
    error(req: Request, res: Response, status: number, payload: any): void;
    registerRoutes(app: Express): void
}

export class DynRestBase implements RestBase {

    constructor(public app: Express) {
        this.registerRoutes(app);
    }

    public async get(req: Request, res: Response) {
        res.status(404).send('Resource not implemented!');
    }

    public async getId(req: Request, res: Response, next, id) {
        res.status(404).send('Resource not implemented!');
    }

    public async returnId(req: Request, res: Response) {
        res.status(404).send('Resource not implemented!');
    }

    public async post(req: Request, res: Response) {
        res.status(404).send('Resource not implemented!');
    }

    public async put(req: Request, res: Response) {
        res.status(404).send('Resource not implemented!');
    }

    public async delete(req: Request, res: Response) {
        res.status(404).send('Resource not implemented!');
    }

    notFound(req: Request, res: Response, payload: any) {
        this.send(req, res, 404, payload);
    }

    error(req: Request, res: Response, payload: any) {
        console.log('Error::res', res);
        this.send(req, res, 500, payload);
    }

    private send(req: Request, res: Response, status: number, payload: any) {
        res.status(status).send(payload);
    }

    registerRoutes(app: Express) {
        app.route('/')
        .get(this.get)
        .post(this.post);

        app.route('/:id')
        .get(this.returnId)
        .put(this.put)
        .delete(this.delete);

        app.param('id', this.getId);
    }
}
