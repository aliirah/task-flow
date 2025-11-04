package authctx

import (
	"context"

	"go.uber.org/zap"
	"google.golang.org/grpc/metadata"
)

type contextKey string

const (
	contextKeyUser contextKey = "authctx.user"
)

const (
	metadataUserID    = "x-user-id"
	metadataEmail     = "x-user-email"
	metadataFirstName = "x-user-first-name"
	metadataLastName  = "x-user-last-name"
	metadataRoles     = "x-user-roles"
	metadataStatus    = "x-user-status"
	metadataUserType  = "x-user-type"
)

// User carries identity and authorisation data across service boundaries.
type User struct {
	ID        string
	Email     string
	FirstName string
	LastName  string
	Roles     []string
	Status    string
	UserType  string
}

// WithUser stores the provided user on the supplied context.
func WithUser(ctx context.Context, user User) context.Context {
	return context.WithValue(ctx, contextKeyUser, user)
}

// UserFromContext extracts user identity information from context.
func UserFromContext(ctx context.Context) (User, bool) {
	if ctx == nil {
		return User{}, false
	}
	if v, ok := ctx.Value(contextKeyUser).(User); ok {
		return v, true
	}
	return User{}, false
}

// Fields returns zap fields representing the user.
func (u User) Fields() []zap.Field {
	fields := []zap.Field{
		zap.String("user_id", u.ID),
		zap.String("user_email", u.Email),
		zap.String("user_type", u.UserType),
		zap.String("user_status", u.Status),
	}
	if u.FirstName != "" {
		fields = append(fields, zap.String("user_first_name", u.FirstName))
	}
	if u.LastName != "" {
		fields = append(fields, zap.String("user_last_name", u.LastName))
	}
	if len(u.Roles) > 0 {
		fields = append(fields, zap.Strings("user_roles", u.Roles))
	}
	return fields
}

// OutgoingContext appends the user metadata to a gRPC outgoing context.
func OutgoingContext(ctx context.Context, user User) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	existingMD, _ := metadata.FromOutgoingContext(ctx)
	md := metadata.New(nil)
	if existingMD != nil {
		md = existingMD.Copy()
	}
	md.Set(metadataUserID, user.ID)
	md.Set(metadataEmail, user.Email)
	md.Set(metadataFirstName, user.FirstName)
	md.Set(metadataLastName, user.LastName)
	md.Set(metadataStatus, user.Status)
	md.Set(metadataUserType, user.UserType)
	delete(md, metadataRoles)
	if len(user.Roles) > 0 {
		md.Set(metadataRoles, user.Roles...)
	}
	return metadata.NewOutgoingContext(ctx, md)
}

// IncomingUser constructs a User from incoming gRPC metadata.
func IncomingUser(ctx context.Context) (User, bool) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return User{}, false
	}
	user := User{
		ID:        first(md[metadataUserID]),
		Email:     first(md[metadataEmail]),
		FirstName: first(md[metadataFirstName]),
		LastName:  first(md[metadataLastName]),
		Status:    first(md[metadataStatus]),
		UserType:  first(md[metadataUserType]),
		Roles:     md[metadataRoles],
	}
	if user.ID == "" {
		return User{}, false
	}
	return user, true
}

func first(values []string) string {
	if len(values) == 0 {
		return ""
	}
	return values[0]
}
