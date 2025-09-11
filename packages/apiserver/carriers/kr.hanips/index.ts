import cjLogistics from '../kr.cjlogistics';
import { CarrierModule } from '../../types/carrier';

const carrierModule: CarrierModule = {
  info: {
    name: '한의사랑택배',
    tel: '+8215884131',
  },
  getTrack: cjLogistics.getTrack,
};

export = carrierModule;
