# User Login Flow

Authentication flow for existing users.

```mermaid
sequenceDiagram
    participant User
    participant WebClient
    participant APIGateway
    participant AuthService
    participant UserService
    participant AuthDB
    participant UserDB

    User->>WebClient: Enter Credentials
    WebClient->>APIGateway: POST /api/auth/login
    APIGateway->>AuthService: gRPC: Login
    
    AuthService->>AuthDB: Verify Credentials
    AuthDB-->>AuthService: Auth User Found
    
    AuthService->>UserService: gRPC: GetUser
    UserService->>UserDB: Fetch User Profile
    UserDB-->>UserService: User Profile
    UserService-->>AuthService: Profile Details
    
    AuthService->>AuthService: Generate JWT Tokens
    AuthService-->>APIGateway: Tokens + Profile
    APIGateway-->>WebClient: Auth Response
    WebClient-->>User: Login Success
```

## Process Steps

1. **Credentials**: User enters email and password
2. **API Request**: Web client sends POST to `/api/auth/login`
3. **Verification**: Auth service verifies password hash against database
4. **Profile Fetch**: Auth service retrieves full user profile from user service
5. **Token Generation**: New JWT tokens are generated
6. **Response**: User receives fresh tokens and complete profile

## Token Management

- **Access Token**: Short-lived (1 hour) for API access
- **Refresh Token**: Long-lived (30 days) for getting new access tokens
- Both tokens stored securely in HTTP-only cookies

## Error Handling

- Invalid credentials return 401 Unauthorized
- Disabled accounts return appropriate error
- Failed login attempts are logged for security monitoring
