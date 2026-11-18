import { Injectable } from '@nestjs/common';

export interface HealthCheckResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

@Injectable()
export class AppService {
  getHealth(): HealthCheckResponse {
    return {
      status: 'ok',
      service: 'ikagi-api',
      timestamp: new Date().toISOString(),
    };
  }

  getData(): { message: string } {
    return { message: 'Hello API' };
  }
}
