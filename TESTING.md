# Testing Guide

This guide provides comprehensive instructions for running tests in the Alchemy Backend application.

## Test Structure

The application includes unit tests for critical components:

### 🔐 Authentication Components
- **AuthService** (`src/auth/auth.service.spec.ts`) - User authentication and JWT token generation
- **JwtStrategy** (`src/auth/jwt.strategy.spec.ts`) - JWT token validation middleware  
- **PermissionGuard** (`src/auth/guards/permission.guard.spec.ts`) - Permission-based access control
- **TenantScopeGuard** (`src/auth/guards/tenant-scope.guard.spec.ts`) - Tenant isolation enforcement

### 📨 Message Processing Components
- **MessageProcessor** (`src/queue/processors/message.processor.spec.ts`) - Async message queue processing
- **WhatsAppService** (`src/whatsapp/whatsapp.service.spec.ts`) - Core message sending with retry logic
- **MessageService** (`src/message/message.service.spec.ts`) - Message logging and retrieval

### 👥 User Management Components
- **UserService** (`src/user/user.service.spec.ts`) - User CRUD operations
- **UserController** (`src/user/user.controller.spec.ts`) - User endpoint handling

## Prerequisites

Ensure you have the required dependencies installed:

```bash
npm install
```

### Test Environment Setup

The test environment is configured with:
- **Test timeout**: 30 seconds
- **JWT Secret**: `test-jwt-secret-key`
- **Database URL**: `mongodb://localhost:27017/test`
- **Redis URL**: `redis://localhost:6379/0`

## Running Tests

### Basic Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (monitors file changes)
npm run test:watch

# Run tests with coverage report
npm run test:cov

# Run tests in debug mode
npm run test:debug
```

### Specialized Test Commands

```bash
# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e

# Run tests without watching (CI mode)
npm run test:ci
```

### Module-Specific Tests

```bash
# Run authentication-related tests
npm run test:auth

# Run WhatsApp-related tests
npm run test:whatsapp

# Run message-related tests
npm run test:message

# Run only changed tests
npm run test:changed

# Run tests with verbose output
npm run test:verbose

# Run tests silently (minimal output)
npm run test:silent
```

## Test Configuration

### Jest Configuration

The application uses Jest with the following key configurations:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "testEnvironment": "node"
}
```

### Coverage Thresholds

The project maintains high code coverage standards:
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

### Custom Matchers

The test suite includes custom Jest matchers:

```typescript
// Check if value is a valid Date
expect(someDate).toBeValidDate();

// Check if value is a valid MongoDB ObjectId
expect(someId).toBeValidObjectId();
```

## Test Categories

### 🧪 Unit Tests

Focus on individual components in isolation:

```bash
# Run specific test file
npx jest src/auth/auth.service.spec.ts

# Run tests matching pattern
npx jest --testPathPattern="auth"
```

### 🔗 Integration Tests

Test component interactions:

```bash
# Run integration tests
npm run test:integration
```

### 🌐 End-to-End Tests

Test complete user workflows:

```bash
# Run E2E tests
npm run test:e2e
```

## Critical Component Tests

### Authentication Middleware Tests

**AuthService** - Validates user credentials and generates JWT tokens:
```bash
npx jest src/auth/auth.service.spec.ts --verbose
```

Key test scenarios:
- ✅ User credential validation with bcrypt
- ✅ JWT token generation with proper payload
- ✅ Error handling for invalid credentials
- ✅ Admin user authentication flow

**JwtStrategy** - Validates JWT tokens and extracts user information:
```bash
npx jest src/auth/jwt.strategy.spec.ts --verbose
```

Key test scenarios:
- ✅ JWT payload validation and user mapping
- ✅ Configuration handling for JWT secret
- ✅ Proper user object structure extraction
- ✅ Edge cases with malformed payloads

### Permission Checking Tests

**PermissionGuard** - Enforces role-based access control:
```bash
npx jest src/auth/guards/permission.guard.spec.ts --verbose
```

Key test scenarios:
- ✅ Permission requirement validation
- ✅ Admin privilege bypass logic
- ✅ User permission array checking
- ✅ Forbidden access exception handling

**TenantScopeGuard** - Ensures tenant data isolation:
```bash
npx jest src/auth/guards/tenant-scope.guard.spec.ts --verbose
```

Key test scenarios:
- ✅ Tenant scope requirement enforcement
- ✅ User tenant ID validation
- ✅ Multi-tenant data isolation
- ✅ Edge cases with missing tenant information

### Message Processing Tests

**MessageProcessor** - Handles async message queue processing:
```bash
npx jest src/queue/processors/message.processor.spec.ts --verbose
```

Key test scenarios:
- ✅ Device validation and connection checking
- ✅ Message sending with progress tracking
- ✅ Different message types (text, media, document, location, contact)
- ✅ Error handling and retry logic
- ✅ Message logging and audit trail
- ✅ Processing time calculation

## Test Data and Mocking

### Mock Services

Tests use comprehensive mocking for external dependencies:

```typescript
// Example: Mocking WhatsApp service
const mockWhatsAppService = {
  findById: jest.fn(),
  sendMessage: jest.fn(),
  // ... other methods
};
```

### Test Data Factories

Consistent test data patterns:

```typescript
// Example: Mock user data
const mockUser = {
  userId: 'user123',
  username: 'testuser',
  tenantId: 'tenant123',
  groupId: 'group123',
  isAdmin: false,
};
```

## Debugging Tests

### Debug Mode

Run tests in debug mode for troubleshooting:

```bash
npm run test:debug
```

### Specific Test Debugging

Debug a specific test file:

```bash
node --inspect-brk node_modules/.bin/jest --runInBand src/auth/auth.service.spec.ts
```

### Verbose Output

Get detailed test execution information:

```bash
npm run test:verbose -- src/auth/auth.service.spec.ts
```

## Coverage Reports

### Generate Coverage

```bash
npm run test:cov
```

Coverage reports are generated in multiple formats:
- **Text**: Console output
- **LCOV**: `coverage/lcov.info`
- **HTML**: `coverage/index.html`
- **JSON**: `coverage/coverage-final.json`

### View Coverage Report

Open the HTML coverage report:

```bash
# On Windows
start coverage/index.html

# On macOS
open coverage/index.html

# On Linux
xdg-open coverage/index.html
```

## Continuous Integration

### CI Test Command

For CI environments, use the dedicated command:

```bash
npm run test:ci
```

This command:
- Runs all tests without watch mode
- Generates coverage reports
- Fails if coverage thresholds are not met
- Passes even if no tests are found (useful for incremental builds)

### GitHub Actions Example

```yaml
- name: Run Tests
  run: npm run test:ci
  
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage/lcov.info
```

## Best Practices

### Writing Tests

1. **AAA Pattern**: Arrange, Act, Assert
2. **Descriptive Names**: Use clear, descriptive test names
3. **Single Responsibility**: One test per behavior
4. **Mock External Dependencies**: Isolate units under test
5. **Test Edge Cases**: Handle error conditions and boundary values

### Test Organization

1. **Group Related Tests**: Use `describe` blocks effectively
2. **Setup and Teardown**: Use `beforeEach` and `afterEach` for common setup
3. **Test Data**: Create reusable test data factories
4. **Async Testing**: Properly handle promises and async operations

### Performance

1. **Parallel Execution**: Jest runs tests in parallel by default
2. **Test Isolation**: Ensure tests don't depend on each other
3. **Resource Cleanup**: Clean up mocks and test data
4. **Selective Testing**: Use focused testing during development

## Troubleshooting

### Common Issues

**Tests Failing Due to Timeout**
```bash
# Increase timeout in jest.config.js or individual tests
jest.setTimeout(60000);
```

**Mock Not Working**
```bash
# Clear mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});
```

**Database Connection Issues**
```bash
# Ensure test database is available
# Check MongoDB connection in test environment
```

**TypeScript Errors**
```bash
# Run TypeScript checks
npx tsc --noEmit
```

### Getting Help

- Check Jest documentation: https://jestjs.io/docs/getting-started
- Review NestJS testing guide: https://docs.nestjs.com/fundamentals/testing
- Examine existing test files for patterns and examples

## Test Coverage Goals

The application maintains high test coverage for critical paths:

- **Authentication flows**: 100% coverage
- **Permission checks**: 100% coverage  
- **Message processing**: 95% coverage
- **Error handling**: 90% coverage
- **API endpoints**: 85% coverage

Regular coverage monitoring ensures code quality and reliability.

---

For questions or issues with testing, please refer to the development team or create an issue in the project repository.