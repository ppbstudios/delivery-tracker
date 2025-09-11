import axios from 'axios';
import * as qs from 'querystring';
import {
  ShippingStatus,
  ShippingInformation,
  CarrierModule,
  TrackingError,
} from '../../types/carrier';

function parseStatusId(
  s: string
): 'information_received' | 'at_pickup' | 'delivered' | 'in_transit' {
  if (s.includes('information sent')) return 'information_received';
  if (s.includes('Picked up')) return 'at_pickup';
  if (s.includes('Delivered')) return 'delivered';
  return 'in_transit';
}

interface FedexEvent {
  date: string;
  time: string;
  gmtOffset: string;
  status: string;
  scanLocation: string;
  legacyCode?: string;
}

interface FedexMilestone {
  name: string;
}

interface FedexActivity {
  date: string;
  time: string;
  milestone?: FedexMilestone;
  activityScan: string;
  location: string;
}

interface FedexTrackInfo {
  originCity: string;
  originCntryCD: string;
  destCity: string;
  destCntryCD: string;
  scanEventList: FedexEvent[];
  shipmentProgressActivities: FedexActivity[];
  isInvalid?: boolean;
  isNotFound?: boolean;
}

interface FedexResponse {
  TrackPackagesResponse: {
    packageList: FedexTrackInfo[];
  };
}

function getTrack(trackId: string): Promise<ShippingInformation> {
  return new Promise<ShippingInformation>((resolve, reject) => {
    axios
      .post<FedexResponse>(
        'https://www.fedex.com/trackingCal/track',
        qs.stringify({
          data: JSON.stringify({
            TrackPackagesRequest: {
              appType: 'WTRK',
              appDeviceType: '',
              supportHTML: true,
              supportCurrentLocation: true,
              uniqueKey: '',
              processingParameters: {},
              trackingInfoList: [
                {
                  trackNumberInfo: {
                    trackingNumber: trackId,
                    trackingQualifier: '',
                    trackingCarrier: '',
                  },
                },
              ],
            },
          }),
          action: 'trackpackages',
          locale: 'en_US',
          version: '1',
          format: 'json',
        })
      )
      .then(res => {
        const info = res.data.TrackPackagesResponse.packageList[0];

        if (info.isInvalid || info.isNotFound) {
          reject({
            code: 404,
            message: 'Tracking ID Error',
          } as TrackingError);
          return;
        }

        const shippingInformation: ShippingInformation = {
          from: {
            address: `${info.originCity}, ${info.originCntryCD}`,
          },
          to: {
            address: `${info.destCity}, ${info.destCntryCD}`,
          },
          state: { id: 'information_received', text: 'information received' },
          progresses: [],
        };

        info.scanEventList.forEach(event => {
          const eventInfo = {
            time: `${event.date}T${event.time}${event.gmtOffset}`,
            status: { id: parseStatusId(event.status), text: event.status },
            location: { name: event.scanLocation },
          };

          if (
            !shippingInformation.from?.time &&
            eventInfo.status.id === 'at_pickup'
          ) {
            if (shippingInformation.from) {
              shippingInformation.from.time = eventInfo.time;
            }
          }

          shippingInformation.progresses.unshift(eventInfo);
        });

        const lastProgress =
          shippingInformation.progresses[
            shippingInformation.progresses.length - 1
          ];
        if (lastProgress) {
          shippingInformation.state = lastProgress.status;
          if (lastProgress.status.id === 'delivered' && shippingInformation.to)
            shippingInformation.to.time = lastProgress.time;
        }

        resolve(shippingInformation);
      })
      .catch((err: Error) => reject(err));
  });
}

const carrierModule: CarrierModule = {
  info: {
    name: 'Fedex',
  },
  getTrack,
};

export = carrierModule;
