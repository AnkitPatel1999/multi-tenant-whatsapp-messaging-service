import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller()
@ApiTags('app')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'API Health Check',
    description: 'Returns basic API information and health status'
  })
  @ApiResponse({
    status: 200,
    description: 'API is running successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Alchemy Backend API is running' },
        version: { type: 'string', example: '1.0.0' },
        timestamp: { type: 'string', example: '2025-01-20T12:00:00.000Z' },
        documentation: { type: 'string', example: '/api/docs' }
      }
    }
  })
  getHello() {
    return {
      message: 'Alchemy Backend API is running',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      documentation: '/api/docs'
    };
  }

  @Get('health')
  @ApiOperation({
    summary: 'Health Check',
    description: 'Check if the API service is healthy and responsive'
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        uptime: { type: 'number', example: 12345.67 },
        timestamp: { type: 'string', example: '2025-01-20T12:00:00.000Z' }
      }
    }
  })
  getHealth() {
    return {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }
}
