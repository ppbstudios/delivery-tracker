import axios from 'axios';
import * as cheerio from 'cheerio';
import { Cookie } from 'tough-cookie';
import * as qs from 'querystring';
import {
  ShippingStatus,
  ShippingInformation,
  CarrierModule,
  TrackingError,
} from '../../types/carrier';

interface StatusMap {
  [key: number]: ShippingStatus;
}

const STATUS_MAP: StatusMap = {
  11: { id: 'at_pickup', text: '상품인수' },
  41: { id: 'in_transit', text: '상품이동중' },
  42: { id: 'in_transit', text: '상품이동중' }, // 원래는 배송지 도착이지만 제공하지 않음 (표준화)
  44: { id: 'in_transit', text: '상품이동중' },
  82: { id: 'out_for_delivery', text: '배송출발' },
  91: { id: 'delivered', text: '배달완료' },
};

function parseTime(s: string): string {
  return `${s.replace(' ', 'T').substring(0, s.lastIndexOf('.'))}+09:00`;
}

function getTrack(trackId: string): Promise<ShippingInformation> {
  return new Promise<ShippingInformation>((resolve, reject) => {
    if (!/^(\d{10}(\d{2})?)?$/.test(trackId)) {
      reject({
        code: 400,
        message: '운송장 번호는 10자리 혹은 12자리입니다.',
      } as TrackingError);
      return;
    }

    axios
      .get('https://www.cjlogistics.com/ko/tool/parcel/tracking')
      .then(res => {
        const cookie = res.headers['set-cookie']
          ?.map(c => Cookie.parse(c)?.cookieString())
          .join('; ');

        const $ = cheerio.load(res.data);

        return axios.post(
          'https://www.cjlogistics.com/ko/tool/parcel/tracking-detail',
          qs.stringify({
            paramInvcNo: trackId,
            _csrf: $('input[name=_csrf]').val(),
          }),
          {
            headers: {
              Cookie: cookie,
            },
          }
        );
      })
      .then(res => {
        const informationTable = res.data.parcelResultMap?.resultList || [];
        const progressTable = res.data.parcelDetailResultMap?.resultList || [];

        if (informationTable.length === 0 && progressTable.length === 0) {
          reject({
            code: 404,
            message: '해당 운송장이 존재하지 않습니다.',
          } as TrackingError);
          return;
        }

        return { informationTable, progressTable };
      })
      .then(({ informationTable, progressTable }) => {
        const shippingInformation: ShippingInformation = {
          from: { name: undefined, time: undefined },
          to: { name: undefined, time: undefined },
          state: { id: 'information_received', text: '상품준비중' },
          progresses: (progressTable || []).map((row: any) => {
            return {
              time: parseTime(row.dTime),
              status: STATUS_MAP[row.crgSt] || {
                id: 'in_transit',
                text: '이동중',
              },
              location: {
                name: row.regBranNm,
              },
              description: row.crgNm,
            };
          }),
        };

        if (shippingInformation.progresses.length > 0) {
          shippingInformation.state =
            shippingInformation.progresses[
              shippingInformation.progresses.length - 1
            ].status;
        }

        if (informationTable.length !== 0) {
          const info = informationTable[0];
          shippingInformation.from = {
            name: `${info.sendrNm.substring(0, 1)}*`,
            time:
              progressTable.length !== 0
                ? parseTime(progressTable[0].dTime)
                : undefined,
          };

          shippingInformation.to = {
            name: `${info.rcvrNm.substring(0, 1)}*`,
            time:
              shippingInformation.state.id === 'delivered'
                ? shippingInformation.progresses[
                    shippingInformation.progresses.length - 1
                  ].time
                : undefined,
          };
        }

        resolve(shippingInformation);
      })
      .catch((err: Error) => reject(err));
  });
}

const carrierModule: CarrierModule = {
  info: {
    name: 'CJ대한통운',
    tel: '+8215881255',
  },
  getTrack,
};

export = carrierModule;
