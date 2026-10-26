export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'TransitOps Node.js REST API',
    version: '1.0.0',
    description:
      'Smart Transport Operations Platform API with Prisma ORM, SQLite/Supabase compatibility, JWT Authentication, and Socket.io real-time streaming.',
    contact: {
      name: 'TransitOps Platform Engineering',
      email: 'engineering@transitops.com',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'Current Environment API Base',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'transitops_jwt',
      },
    },
  },
  paths: {
    '/auth/login': {
      post: {
        summary: 'User Login & JWT issuance',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', example: 'manager@transitops.com' },
                  password: { type: 'string', example: 'the password configured for this account' },
                },
                required: ['email'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Successful authentication returning JWT token' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Current Authenticated User Session',
        tags: ['Authentication'],
        responses: {
          200: { description: 'Current user profile' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Log out current user',
        tags: ['Authentication'],
        responses: { 204: { description: 'Logged out successfully' } },
      },
    },
    '/vehicles': {
      get: {
        summary: 'List all fleet vehicles',
        tags: ['Vehicles'],
        responses: { 200: { description: 'Array of fleet vehicles' } },
      },
      post: {
        summary: 'Add a new vehicle asset',
        tags: ['Vehicles'],
        responses: { 201: { description: 'Vehicle created' } },
      },
    },
    '/vehicles/{id}': {
      put: {
        summary: 'Update vehicle asset details',
        tags: ['Vehicles'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Vehicle updated' } },
      },
      delete: {
        summary: 'Retire a vehicle asset',
        tags: ['Vehicles'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Vehicle retired' } },
      },
    },
    '/drivers': {
      get: {
        summary: 'List all drivers with compliance status',
        tags: ['Drivers'],
        responses: { 200: { description: 'Array of drivers' } },
      },
      post: {
        summary: 'Onboard a new driver',
        tags: ['Drivers'],
        responses: { 201: { description: 'Driver created' } },
      },
    },
    '/drivers/{id}/safety-score': {
      get: {
        summary: 'Get driver safety score calculation breakdown',
        tags: ['Drivers'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Safety score and factor details' } },
      },
    },
    '/trips': {
      get: {
        summary: 'List freight trips and dispatch orders',
        tags: ['Trips'],
        responses: { 200: { description: 'Array of trips' } },
      },
      post: {
        summary: 'Create a new trip dispatch draft',
        tags: ['Trips'],
        responses: { 201: { description: 'Trip created' } },
      },
    },
    '/trips/{id}/dispatch': {
      post: {
        summary: 'Dispatch an approved trip to active transit',
        tags: ['Trips'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Trip dispatched' } },
      },
    },
    '/trips/{id}/complete': {
      post: {
        summary: 'Complete a trip with final odometer & fuel liters',
        tags: ['Trips'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Trip completed and vehicle released' } },
      },
    },
    '/maintenance': {
      get: {
        summary: 'List maintenance work orders',
        tags: ['Maintenance'],
        responses: { 200: { description: 'Array of maintenance records' } },
      },
      post: {
        summary: 'Log a new maintenance service (sets vehicle In Shop)',
        tags: ['Maintenance'],
        responses: { 201: { description: 'Maintenance record logged' } },
      },
    },
    '/maintenance/{id}/close': {
      post: {
        summary: 'Close a maintenance work order (returns vehicle to Available)',
        tags: ['Maintenance'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Work order closed' } },
      },
    },
    '/expenses': {
      get: {
        summary: 'List fuel and operational expenses',
        tags: ['Expenses'],
        responses: { 200: { description: 'Array of expenses' } },
      },
      post: {
        summary: 'Record fuel, toll, or misc operational expense',
        tags: ['Expenses'],
        responses: { 201: { description: 'Expense recorded' } },
      },
    },
    '/kpi/fleet': {
      get: {
        summary: 'Fleet utilization, active dispatches, and asset counts',
        tags: ['KPIs'],
        responses: { 200: { description: 'Fleet KPI metrics' } },
      },
    },
    '/kpi/financial': {
      get: {
        summary: 'Revenue, Total Opex, Cost Per KM, and Net Margin',
        tags: ['KPIs'],
        responses: { 200: { description: 'Financial analytics metrics' } },
      },
    },
    '/reports/export/pdf/ledger': {
      get: {
        summary: 'Export Financial Ledger as PDF',
        tags: ['Reports'],
        responses: { 200: { description: 'PDF stream' } },
      },
    },
    '/reports/export/pdf/fleet-roi': {
      get: {
        summary: 'Export Fleet ROI Matrix as PDF',
        tags: ['Reports'],
        responses: { 200: { description: 'PDF stream' } },
      },
    },
    '/onboarding/plans': {
      get: {
        summary: 'Retrieve available SaaS subscription plans',
        tags: ['SaaS Onboarding'],
        responses: { 200: { description: 'List of plans' } },
      },
    },
  },
};
