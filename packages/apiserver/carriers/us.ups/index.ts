import axios from 'axios';
import {
  ShippingStatus,
  ShippingInformation,
  CarrierModule,
  TrackingError,
} from '../../types/carrier';

function getTime(location: string, date: string, time: string): string {
  // WARNING : Timezone is ignored.
  const dateResult = /^(\d+)\/(\d+)\/(\d+)$/.exec(date);
  const timeResult = /^(\d+):(\d+) (A\.M\.|P\.M\.)$/.exec(time);

  if (!dateResult || !timeResult) return `${date}T${time}`;

  let hour = parseInt(timeResult[1], 10);
  if (hour === 12) hour = 0;
  if (timeResult[3] === 'P.M.') hour += 12;
  const hourStr = hour < 10 ? `0${hour}` : `${hour}`;

  // TODO : timezone convert
  return `${dateResult[3]}-${dateResult[1]}-${dateResult[2]}T${hourStr}:${timeResult[2]}:00Z`;
}

function parseStatusId(
  name: string
):
  | 'information_received'
  | 'at_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'in_transit' {
  if (name === 'cms.stapp.orderReceived') return 'information_received';
  if (name === 'cms.stapp.shipped') return 'at_pickup';
  if (name === 'cms.stapp.outForDelivery') return 'out_for_delivery';
  if (name === 'cms.stapp.delivered') return 'delivered';
  return 'in_transit';
}

interface UPSMilestone {
  name?: string;
}

interface UPSActivity {
  date: string;
  time: string;
  location: string;
  milestone?: UPSMilestone;
  activityScan: string;
}

interface UPSTrackDetails {
  errorCode?: string;
  errorText?: string;
  shipmentProgressActivities: UPSActivity[];
}

interface UPSResponse {
  statusCode: string;
  statusText?: string;
  trackDetails: UPSTrackDetails[];
}

function getTrack(trackId: string): Promise<ShippingInformation> {
  return new Promise<ShippingInformation>((resolve, reject) => {
    axios
      .post<UPSResponse>(
        'https://www.ups.com/track/api/Track/GetStatus?loc=en_US',
        {
          Locale: 'en_US',
          TrackingNumber: [trackId],
        }
      )
      .then(res => {
        if (
          res.data.statusCode !== '200' ||
          res.data.trackDetails[0].errorCode
        ) {
          reject({
            code: 404,
            message: res.data.trackDetails
              ? res.data.trackDetails[0].errorText || 'Error'
              : res.data.statusText || 'Error',
          } as TrackingError);
          return;
        }

        const info = res.data.trackDetails[0];

        const shippingInformation: ShippingInformation = {
          from: {},
          to: {},
          state: { id: 'information_received', text: 'information received' },
          progresses: [],
        };

        info.shipmentProgressActivities.forEach(event => {
          const eventInfo = {
            time: getTime(event.location, event.date, event.time),
            status: {
              id: parseStatusId(
                event.milestone ? event.milestone.name || '' : ''
              ),
              text: event.activityScan,
            },
            location: { name: event.location },
          };

          if (
            !shippingInformation.from?.time &&
            eventInfo.status.id === 'at_pickup'
          ) {
            shippingInformation.from = {
              time: eventInfo.time,
              address: event.location,
            };
          }

          shippingInformation.progresses.unshift(eventInfo);
        });

        const lastProgress =
          shippingInformation.progresses[
            shippingInformation.progresses.length - 1
          ];
        if (lastProgress) {
          shippingInformation.state = lastProgress.status;
          if (lastProgress.status.id === 'delivered') {
            shippingInformation.to = {
              time: lastProgress.time,
              address: lastProgress.location?.name,
            };
          }
        }

        resolve(shippingInformation);
      })
      .catch((err: Error) => reject(err));
  });
}

const carrierModule: CarrierModule = {
  info: {
    name: 'UPS',
  },
  getTrack,
};

export = carrierModule;
