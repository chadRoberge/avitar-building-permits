# Avitar Building Permits

A comprehensive building permit management system built with Ember.js frontend and Express.js backend, featuring multi-user types and Stripe billing integration.

## Features

### Multi-User System
- **Residential Users**: Submit and track building permit applications for their properties
- **Commercial Users**: Manage permits for multiple properties and client work  
- **Municipal Users**: Review permits, manage workflows, and handle billing subscriptions

### Key Functionality
- **Property Management**: Multi-property support with municipality-based filtering
- **Permit Workflow**: Complete permit submission, review, and approval process
- **Real-time Messaging**: Built-in chat system for permit communications
- **Billing System**: Stripe-integrated subscription management for municipalities
- **Department Reviews**: Multi-department review workflow with status tracking

### Technology Stack
- **Frontend**: Ember.js (Octane edition)
- **Backend**: Express.js with MongoDB
- **Database**: MongoDB Atlas
- **Payments**: Stripe integration
- **Authentication**: JWT-based auth system
- **Deployment**: Vercel-ready configuration

## Prerequisites

You will need the following things properly installed on your computer.

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) (with npm)
- [Ember CLI](https://cli.emberjs.com/release/)
- [Google Chrome](https://google.com/chrome/)

## Installation

- `git clone <repository-url>` this repository
- `cd avitar-building-permits`
- `npm install`

## Running / Development

### Start Both Frontend and Backend:
```bash
npm run dev
```

### Start Individually:
```bash
# Frontend only (Ember.js)
npm run start

# Backend only (Express.js)  
npm run server
```

- Visit your app at [http://localhost:4200](http://localhost:4200)
- Backend API at [http://localhost:3000](http://localhost:3000)
- Visit your tests at [http://localhost:4200/tests](http://localhost:4200/tests)

### Environment Setup:
1. Copy `server/.env.example` to `server/.env`
2. Add your MongoDB connection string
3. Add your Stripe API keys
4. Configure other environment variables

### Code Generators

Make use of the many generators for code, try `ember help generate` for more details

### Running Tests

- `npm run test`
- `npm run test:ember -- --server`

### Linting

- `npm run lint`
- `npm run lint:fix`

### Building

- `npm exec ember build` (development)
- `npm run build` (production)

### Deploying

This application is configured for Vercel deployment. See [DEPLOYMENT.md](DEPLOYMENT.md) for complete instructions.

Quick deploy to Vercel:
1. Push to GitHub
2. Connect repository to Vercel
3. Configure environment variables
4. Deploy automatically

## Further Reading / Useful Links

- [ember.js](https://emberjs.com/)
- [ember-cli](https://cli.emberjs.com/release/)
- Development Browser Extensions
  - [ember inspector for chrome](https://chrome.google.com/webstore/detail/ember-inspector/bmdblncegkenkacieihfhpjfppoconhi)
  - [ember inspector for firefox](https://addons.mozilla.org/en-US/firefox/addon/ember-inspector/)
