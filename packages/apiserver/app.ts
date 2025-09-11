import * as path from 'path';
import * as fs from 'fs';
import * as i18n from 'i18n';
import cors from 'cors';
import { Application, Request, Response } from 'express';
import { CarrierModule } from './types/carrier';

i18n.configure({
  locales: ['en', 'ja', 'ko'],
  directory: path.join(__dirname, 'locales'),
});

interface CarrierInfo {
  id: string;
  name: string;
  tel?: string;
}

interface CarrierMap {
  [key: string]: CarrierModule;
}

function initApp(app: Application): Application {
  app.use(cors());
  app.use(i18n.init);

  const CARRIERS: CarrierMap = {};

  fs.readdirSync(path.join(__dirname, 'carriers')).forEach((name: string) => {
    // eslint-disable-next-line no-console
    console.log(`load carrier ${name}`);
    // eslint-disable-next-line global-require, import/no-dynamic-require
    CARRIERS[name] = require(`./carriers/${name}`);
  });

  const CARRIERS_INFOS: CarrierInfo[] = Object.keys(CARRIERS).map(
    (id: string) => ({
      id,
      ...CARRIERS[id].info,
    })
  );

  app.get('/carriers', (req: Request, res: Response) => {
    res.json(CARRIERS_INFOS);
  });

  app.get('/carriers/:carrierId', (req: Request, res: Response) => {
    if (!(req.params.carrierId in CARRIERS)) {
      res.status(404).json({
        message: (res as any)._('not supported carrier'),
      });
      return;
    }

    res.json({
      id: req.params.carrierId,
      ...CARRIERS[req.params.carrierId].info,
    });
  });

  app.get(
    '/carriers/:carrierId/tracks/:trackId',
    (req: Request, res: Response) => {
      const { carrierId, trackId } = req.params;

      if (!(carrierId in CARRIERS)) {
        res.status(404).json({
          message: (res as any)._('not supported carrier'),
        });
        return;
      }

      CARRIERS[carrierId]
        .getTrack(trackId)
        .then(info =>
          res.status(200).json({
            ...info,
            carrier: {
              id: carrierId,
              ...CARRIERS[carrierId].info,
            },
          })
        )
        .catch((err: any) =>
          res.status(typeof err.code === 'number' ? err.code : 500).json({
            message: err.message
              ? err.message
              : (res as any)._('error message'),
          })
        );
    }
  );

  return app;
}

export = initApp;
