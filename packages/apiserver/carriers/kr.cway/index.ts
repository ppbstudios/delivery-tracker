import cjLogistics from '../kr.cjlogistics';
import { CarrierModule } from '../../types/carrier';

const carrierModule: CarrierModule = {
  info: {
    name: '택배마을',
    tel: '+8218992407',
  },
  getTrack: cjLogistics.getTrack,
};

export = carrierModule;
