import Hanjin from '../kr.hanjin';
import { CarrierModule } from '../../types/carrier';

const carrierModule: CarrierModule = {
  info: {
    name: '홈픽',
    tel: '+8218000987',
  },
  getTrack: Hanjin.getTrack,
};

export = carrierModule;
