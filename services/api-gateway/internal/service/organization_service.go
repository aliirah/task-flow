package service

import (
	"context"
	"errors"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	gatewaylog "github.com/aliirah/task-flow/shared/logging"
	"github.com/aliirah/task-flow/shared/messaging"
	organizationpb "github.com/aliirah/task-flow/shared/proto/organization/v1"
	orgtransform "github.com/aliirah/task-flow/shared/transform/organization"
	usertransform "github.com/aliirah/task-flow/shared/transform/user"
)

type OrganizationService interface {
	Create(ctx context.Context, req *organizationpb.CreateOrganizationRequest) (*organizationpb.Organization, error)
	Get(ctx context.Context, id string) (*organizationpb.Organization, error)
	List(ctx context.Context, req *organizationpb.ListOrganizationsRequest) (*organizationpb.ListOrganizationsResponse, error)
	ListByIDs(ctx context.Context, ids []string) ([]*organizationpb.Organization, error)
	Update(ctx context.Context, req *organizationpb.UpdateOrganizationRequest) (*organizationpb.Organization, error)
	Delete(ctx context.Context, req *organizationpb.DeleteOrganizationRequest) error

	AddMember(ctx context.Context, req *organizationpb.AddMemberRequest) (*organizationpb.OrganizationMember, error)
	RemoveMember(ctx context.Context, req *organizationpb.RemoveMemberRequest) error
	ListMembers(ctx context.Context, req *organizationpb.ListMembersRequest) (*organizationpb.ListMembersResponse, error)
	ListUserMemberships(ctx context.Context, req *organizationpb.ListUserMembershipsRequest) (*organizationpb.ListUserMembershipsResponse, error)
	BuildMemberViews(ctx context.Context, members []*organizationpb.OrganizationMember) ([]gin.H, error)
	ConfigureConnection(conn *websocket.Conn)
	SubscribeMemberships(ctx context.Context, userID, connID string, connMgr *messaging.ConnectionManager) (map[string]struct{}, error)
	HandleSubscriptionMessages(conn *websocket.Conn, connMgr *messaging.ConnectionManager, connID, userID string, allowed map[string]struct{})
}

func NewOrganizationService(client organizationpb.OrganizationServiceClient, userSvc UserService) OrganizationService {
	return &organizationService{client: client, userService: userSvc}
}

type organizationService struct {
	client      organizationpb.OrganizationServiceClient
	userService UserService
}

func (s *organizationService) Create(ctx context.Context, req *organizationpb.CreateOrganizationRequest) (*organizationpb.Organization, error) {
	if s.client == nil {
		return nil, errors.New("organization service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	return s.client.CreateOrganization(ctx, req)
}

func (s *organizationService) Get(ctx context.Context, id string) (*organizationpb.Organization, error) {
	if s.client == nil {
		return nil, errors.New("organization service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	return s.client.GetOrganization(ctx, &organizationpb.GetOrganizationRequest{Id: id})
}

func (s *organizationService) List(ctx context.Context, req *organizationpb.ListOrganizationsRequest) (*organizationpb.ListOrganizationsResponse, error) {
	if s.client == nil {
		return nil, errors.New("organization service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	return s.client.ListOrganizations(ctx, req)
}

func (s *organizationService) ListByIDs(ctx context.Context, ids []string) ([]*organizationpb.Organization, error) {
	if s.client == nil {
		return nil, errors.New("organization service client not configured")
	}
	if len(ids) == 0 {
		return []*organizationpb.Organization{}, nil
	}
	ctx = withOutgoingAuth(ctx)
	resp, err := s.client.ListOrganizationsByIDs(ctx, &organizationpb.ListOrganizationsByIDsRequest{Ids: ids})
	if err != nil {
		return nil, err
	}
	return resp.GetItems(), nil
}

func (s *organizationService) Update(ctx context.Context, req *organizationpb.UpdateOrganizationRequest) (*organizationpb.Organization, error) {
	if s.client == nil {
		return nil, errors.New("organization service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	return s.client.UpdateOrganization(ctx, req)
}

func (s *organizationService) Delete(ctx context.Context, req *organizationpb.DeleteOrganizationRequest) error {
	if s.client == nil {
		return errors.New("organization service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	_, err := s.client.DeleteOrganization(ctx, req)
	return err
}

func (s *organizationService) AddMember(ctx context.Context, req *organizationpb.AddMemberRequest) (*organizationpb.OrganizationMember, error) {
	if s.client == nil {
		return nil, errors.New("organization service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	return s.client.AddMember(ctx, req)
}

func (s *organizationService) RemoveMember(ctx context.Context, req *organizationpb.RemoveMemberRequest) error {
	if s.client == nil {
		return errors.New("organization service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	_, err := s.client.RemoveMember(ctx, req)
	return err
}

func (s *organizationService) ListMembers(ctx context.Context, req *organizationpb.ListMembersRequest) (*organizationpb.ListMembersResponse, error) {
	if s.client == nil {
		return nil, errors.New("organization service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	return s.client.ListMembers(ctx, req)
}

func (s *organizationService) ListUserMemberships(ctx context.Context, req *organizationpb.ListUserMembershipsRequest) (*organizationpb.ListUserMembershipsResponse, error) {
	if s.client == nil {
		return nil, errors.New("organization service client not configured")
	}
	ctx = withOutgoingAuth(ctx)
	return s.client.ListUserMemberships(ctx, req)
}

func (s *organizationService) BuildMemberViews(ctx context.Context, members []*organizationpb.OrganizationMember) ([]gin.H, error) {
	if len(members) == 0 {
		return []gin.H{}, nil
	}
	if s.userService == nil {
		return nil, errors.New("organization service dependencies not configured")
	}

	userIDs := make([]string, 0, len(members))
	orgIDs := make(map[string]struct{})
	for _, member := range members {
		userIDs = append(userIDs, member.GetUserId())
		if orgID := member.GetOrganizationId(); orgID != "" {
			orgIDs[orgID] = struct{}{}
		}
	}

	users, err := s.userService.ListByIDs(ctx, userIDs)
	if err != nil {
		return nil, err
	}

	userMap := make(map[string]*User, len(users))
	for _, user := range users {
		userMap[user.GetId()] = user
	}

	for _, member := range members {
		userID := member.GetUserId()
		if userID == "" {
			continue
		}
		if _, exists := userMap[userID]; exists {
			continue
		}
		user, fetchErr := s.userService.Get(ctx, userID)
		if fetchErr != nil {
			if st, ok := status.FromError(fetchErr); ok && st.Code() == codes.NotFound {
				continue
			}
			return nil, fetchErr
		}
		userMap[userID] = user
	}

	orgMap := make(map[string]*organizationpb.Organization, len(orgIDs))
	for id := range orgIDs {
		org, err := s.Get(ctx, id)
		if err != nil {
			return nil, err
		}
		orgMap[id] = org
	}

	items := make([]gin.H, 0, len(members))
	for _, member := range members {
		item := orgtransform.MemberToMap(member)
		if user := userMap[member.GetUserId()]; user != nil {
			item["user"] = usertransform.ToMap(user)
		}
		if org := orgMap[member.GetOrganizationId()]; org != nil {
			item["organization"] = orgtransform.ToMap(org)
		}
		items = append(items, item)
	}

	return items, nil
}

func (s *organizationService) ConfigureConnection(conn *websocket.Conn) {
	conn.SetReadLimit(1024)
	_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
}

func (s *organizationService) SubscribeMemberships(ctx context.Context, userID, connID string, connMgr *messaging.ConnectionManager) (map[string]struct{}, error) {
	allowed := make(map[string]struct{})
	resp, err := s.ListUserMemberships(ctx, &organizationpb.ListUserMembershipsRequest{UserId: userID})
	if err != nil {
		return nil, err
	}
	for _, membership := range resp.GetMemberships() {
		orgID := membership.GetOrganizationId()
		if orgID == "" {
			continue
		}
		allowed[orgID] = struct{}{}
		if connMgr != nil {
			_ = connMgr.Subscribe(connID, orgID)
		}
	}
	return allowed, nil
}

func (s *organizationService) HandleSubscriptionMessages(conn *websocket.Conn, connMgr *messaging.ConnectionManager, connID, userID string, allowed map[string]struct{}) {
	defer func() {
		connMgr.Remove(connID)
		_ = conn.Close()
	}()

	for {
		var msg struct {
			Type           string `json:"type"`
			OrganizationID string `json:"organizationId"`
		}
		if err := conn.ReadJSON(&msg); err != nil {
			if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				gatewaylog.Warn("read websocket message", zap.Error(err), zap.String("userId", userID))
			}
			break
		}

		switch msg.Type {
		case "subscribe":
			if msg.OrganizationID == "" {
				continue
			}
			if _, ok := allowed[msg.OrganizationID]; ok {
				if err := connMgr.Subscribe(connID, msg.OrganizationID); err != nil {
					gatewaylog.Warn("subscribe organization channel", zap.Error(err), zap.String("userId", userID), zap.String("orgId", msg.OrganizationID))
				}
			}
		case "unsubscribe":
			if msg.OrganizationID == "" {
				continue
			}
			connMgr.Unsubscribe(connID, msg.OrganizationID)
		}
	}
}
