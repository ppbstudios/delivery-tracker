import cjLogistics from '../kr.cjlogistics';
import { CarrierModule } from '../../types/carrier';

const carrierModule: CarrierModule = {
  info: {
    name: 'CU 편의점택배',
    tel: '+8215771287',
  },
  getTrack: cjLogistics.getTrack,
};

export = carrierModule;
