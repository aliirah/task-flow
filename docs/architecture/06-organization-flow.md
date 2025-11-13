# Organization Management Flow

Organization creation and member management flows.

```mermaid
sequenceDiagram
    participant User
    participant WebClient
    participant APIGateway
    participant OrgService
    participant UserService
    participant OrgDB

    User->>WebClient: Create Organization
    WebClient->>APIGateway: POST /api/organizations
    APIGateway->>OrgService: gRPC: CreateOrganization
    
    OrgService->>OrgDB: Create Organization
    OrgDB-->>OrgService: Org Created
    
    OrgService->>OrgDB: Add Creator as Admin Member
    OrgDB-->>OrgService: Member Added
    
    OrgService-->>APIGateway: Organization Response
    APIGateway-->>WebClient: Org Created
    WebClient-->>User: Success

    Note over User,OrgDB: Add Member to Organization

    User->>WebClient: Add Member
    WebClient->>APIGateway: POST /api/organizations/:id/members
    APIGateway->>OrgService: gRPC: AddMember
    
    OrgService->>UserService: gRPC: GetUser (Verify User Exists)
    UserService-->>OrgService: User Details
    
    OrgService->>OrgDB: Create Membership
    OrgDB-->>OrgService: Member Added
    
    OrgService-->>APIGateway: Member Response
    APIGateway-->>WebClient: Member Added
    WebClient-->>User: Success
```

## Organization Operations

### Create Organization
1. User provides organization name and description
2. Organization created in database
3. Creator automatically added as admin member
4. Organization ID returned for future operations

### Add Member
1. Admin provides user email or ID
2. User service verifies user exists
3. Membership created with specified role
4. Member can now access organization resources

### Member Roles
- **admin**: Full control (add/remove members, delete org)
- **member**: Standard access (create/edit tasks)
- **viewer**: Read-only access

### List Organizations
- Users can list organizations they belong to
- Filter by membership role
- Pagination support for large lists

## Authorization

- Only organization admins can add/remove members
- Only organization admins can delete organization
- All organization members can create tasks
- Task access restricted to organization members
