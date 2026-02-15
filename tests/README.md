# AI Fabrix Builder - Testing Guide

## Testing Standards (ISO 27001 Compliant)

This project follows strict testing standards to ensure code quality, security, and compliance with ISO 27001 requirements.

## Test Structure

All tests are organized in the `tests/` directory, mirroring the main code structure:

```yaml
tests/
├── lib/                    # Tests for lib/ modules
│   ├── app.test.js        # Application management tests
│   ├── validator.test.js  # Schema validation tests
│   ├── cli.test.js        # CLI interface tests
│   └── generator.test.js  # Code generation tests
├── bin/                    # Tests for bin/ executables
│   └── aifabrix.test.js   # Main CLI executable tests
├── integration/            # Integration tests
│   ├── build.test.js      # Build process tests
│   ├── deploy.test.js     # Deployment tests
│   └── security.test.js   # Security validation tests
├── manual/                 # Manual tests (real API calls; excluded from CI; run: npm run test:manual)
│   ├── README.md          # Prerequisites and usage
│   ├── setup.js           # Auth validation before tests
│   ├── require-auth.js    # Auth/config helper
│   └── api-auth.test.js   # Real Controller API tests
└── setup.js               # Test configuration and utilities
```

## Testing Requirements

### Mandatory Test Coverage
- **100% function coverage** - Every function must have tests
- **80% line coverage** - Minimum acceptable coverage threshold
- **All edge cases** - Error conditions, boundary values, and failure scenarios
- **Security tests** - Authentication, authorization, and data protection

### Test Types

#### Unit Tests
- Test individual functions and modules in isolation
- Mock external dependencies
- Focus on specific functionality and edge cases
- Fast execution (< 100ms per test)

#### Integration Tests
- Test module interactions and data flow
- Test with real external services (Docker, APIs)
- Validate end-to-end workflows
- Longer execution time acceptable

#### Security Tests
- Authentication and authorization flows
- Input validation and sanitization
- Data encryption and protection
- Vulnerability scanning

## Running Tests

### Development
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/lib/validator.test.js
```

### Continuous Integration
```bash
# Run tests with coverage (for CI/build)
npm run test:coverage

# Run linting
npm run lint

# Run full validation (lint + test with coverage)
npm run validate
```

### Manual tests (real API calls)

Manual tests live in **tests/manual/**. They call **real** Controller and Dataplane APIs (no mocks), are **excluded from CI** and default `npm test`, and **require you to be logged in**.

- **Prerequisite**: Run `aifabrix login` (or have valid client credentials). Before running, the suite validates auth with `aifabrix auth status --validate`; if validation fails, no tests run and the full error is shown.
- **Run**: `npm run test:manual`
- See **tests/manual/README.md** for details and configuration.

## Test Writing Guidelines

### Test Structure
```javascript
describe('Module Name', () => {
  describe('functionName', () => {
    it('should handle normal case', () => {
      // Arrange
      const input = 'test input';
      const expected = 'expected output';
      
      // Act
      const result = functionName(input);
      
      // Assert
      expect(result).toBe(expected);
    });

    it('should handle error case', () => {
      // Test error conditions
    });

    it('should handle edge case', () => {
      // Test boundary conditions
    });
  });
});
```

### Security Test Requirements
- Test authentication mechanisms
- Validate input sanitization
- Check authorization controls
- Verify data encryption
- Test error handling (no information leakage)

### Performance Test Requirements
- Test with realistic data volumes
- Validate timeout handling
- Check memory usage
- Verify concurrent operation handling

## Quality Gates

### Pre-Commit Checks
1. ✅ All tests pass (100% success rate)
2. ✅ Test coverage meets requirements (≥80%)
3. ✅ No linting errors
4. ✅ Security tests pass
5. ✅ Performance tests pass

### Continuous Integration Checks
1. ✅ Full test suite passes
2. ✅ Coverage reports generated
3. ✅ Security scan passes
4. ✅ Build process completes
5. ✅ Documentation updated

## Test Data Management

### Test Fixtures
- Use realistic but anonymized test data
- Never use production data in tests
- Create reusable test fixtures
- Clean up test data after each test

### Mocking Strategy
- Mock external services (Docker, APIs)
- Mock file system operations
- Mock network requests
- Use dependency injection for testability

## Security Testing

### Authentication Tests
- Valid credentials acceptance
- Invalid credentials rejection
- Token expiration handling
- Session management

### Authorization Tests
- Role-based access control
- Permission validation
- Resource access restrictions
- Privilege escalation prevention

### Data Protection Tests
- Input validation and sanitization
- SQL injection prevention
- XSS prevention
- Data encryption validation

## Performance Testing

### Load Testing
- Concurrent user simulation
- Resource usage monitoring
- Response time validation
- Memory leak detection

### Stress Testing
- System limits testing
- Failure recovery testing
- Resource exhaustion handling
- Graceful degradation

## Test Maintenance

### Regular Updates
- Update tests when requirements change
- Refactor tests for maintainability
- Remove obsolete tests
- Add tests for new features

### Documentation
- Document test purpose and scope
- Explain complex test scenarios
- Maintain test data documentation
- Update test environment setup

## Troubleshooting

### Common Issues
- **Tests failing**: Check test data and environment setup
- **Coverage low**: Add tests for missing code paths
- **Slow tests**: Optimize test data and mocking
- **Flaky tests**: Improve test isolation and timing

### Debugging Tests
- Use `console.log` for debugging (tests only)
- Check test environment variables
- Verify mock configurations
- Review test execution order

---

**Remember**: Tests are not optional. Every function must be tested, and all tests must pass before any code is committed or deployed.
