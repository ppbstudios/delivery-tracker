// 공통 타입 정의

export interface CarrierInfo {
  name: string;
  tel?: string;
}

export interface ShippingStatus {
  id:
    | 'information_received'
    | 'at_pickup'
    | 'in_transit'
    | 'out_for_delivery'
    | 'delivered';
  text: string;
}

export interface Location {
  name: string;
  address?: string;
}

export interface TrackingProgress {
  time: string;
  status: ShippingStatus;
  location?: Location;
  description?: string;
}

export interface ShippingAddress {
  name?: string;
  address?: string;
  tel?: string;
  time?: string;
}

export interface ShippingInformation {
  from?: ShippingAddress;
  to?: ShippingAddress;
  state: ShippingStatus;
  progresses: TrackingProgress[];
  item?: string;
}

export interface TrackingError {
  code: number;
  message: string;
}

export interface CarrierModule {
  info: CarrierInfo;
  getTrack: (trackId: string) => Promise<ShippingInformation>;
}

// Axios 응답 타입
export interface AxiosResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: any;
  config: any;
}

// 일반적인 응답 타입들
export interface DOMElement {
  textContent: string;
  innerHTML: string;
  querySelectorAll: (selector: string) => DOMElement[];
  querySelector: (selector: string) => DOMElement | null;
}

export interface ParsedDOM {
  window: {
    document: {
      querySelector: (selector: string) => DOMElement | null;
      querySelectorAll: (selector: string) => DOMElement[];
    };
  };
}
