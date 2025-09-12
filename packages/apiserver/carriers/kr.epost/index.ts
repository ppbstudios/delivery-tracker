import axios from 'axios';
import * as cheerio from 'cheerio';
import {decode} from 'html-entities';
import * as qs from 'querystring';
import {
  ShippingStatus,
  ShippingInformation,
  CarrierModule,
  TrackingError,
} from '../../types/carrier';

function parseStatus(s: string): ShippingStatus {
  if (s.includes('집하완료')) return { id: 'at_pickup', text: '상품인수' };
  if (s.includes('배달준비'))
    return { id: 'out_for_delivery', text: '배송출발' };
  if (s.includes('배달완료')) return { id: 'delivered', text: '배송완료' };
  return { id: 'in_transit', text: '이동중' };
}

function getTrack(trackId: string): Promise<ShippingInformation> {
  const trimString = (s: string): string => {
    return s.replace(/([\n\t]{1,}|\s{2,})/g, ' ').trim();
  };

  return new Promise<ShippingInformation>((resolve, reject) => {
    axios
      .get('http://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm', {
        params: {
          sid1: trackId,
        },
      })
      .then(res => {
        const $ = cheerio.load(res.data);
        const tables = $('table');

        if (tables.length === 0) {
          reject({
            code: 404,
            message: '운송장 번호를 확인하여 주세요',
          } as TrackingError);
          return;
        }

        return {
          informationTable: $(tables[0]),
          progressTable: $(tables[1]),
        };
      })
      .then(({ informationTable, progressTable }) => {
        const from = informationTable
          .find('tr:nth-child(2)')
          .eq(0)
          .find('td')
          .eq(1)
          .text()
          .trim();
        const to = informationTable
          .find('tr:nth-child(2)')
          .eq(0)
          .find('td')
          .eq(3)
          .text()
          .trim();

        const shippingInformation: ShippingInformation = {
          from: {
            name: from,
            time: undefined,
          },
          to: {
            name: to,
            time: undefined,
          },
          progresses: [],
        };


        progressTable.find('tr:not(:first-child)').each((i, element) => {
          const $element = cheerio.load(element);
          const td = $element('td');

          const timeText = decode($element(td[0]).html() || '');
          const time = `${timeText.replace(' ', 'T').replace(/\./g, '-')}+09:00`;

          const statusText = $element(td[1]).text().trim();
          const progress = {
            time,
            status: parseStatus(statusText),
            location: {
              name: $element(td[2]).find('a').first().text().trim(),
            },
            description: statusText,
          };

          shippingInformation.progresses.unshift(progress);
        });

        if (shippingInformation.progresses.length > 0) {
          shippingInformation.state =
            shippingInformation.progresses[
              shippingInformation.progresses.length - 1
            ].status;

          if (shippingInformation.from) {
            shippingInformation.from.time =
              shippingInformation.progresses[0].time;
          }

          if (
            shippingInformation.progresses[
              shippingInformation.progresses.length - 1
            ].status.id === 'delivered' &&
            shippingInformation.to
          ) {
            shippingInformation.to.time =
              shippingInformation.progresses[
                shippingInformation.progresses.length - 1
              ].time;
          }
        }

        resolve(shippingInformation);
      })
      .catch((err: Error) => reject(err));
  });
}

const carrierModule: CarrierModule = {
  info: {
    name: '우체국택배',
    tel: '+821588',
  },
  getTrack,
};

export = carrierModule;
