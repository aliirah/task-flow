package service

import (
	"context"
	"errors"

	organizationpb "github.com/aliirah/task-flow/shared/proto/organization/v1"
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
}

func NewOrganizationService(client organizationpb.OrganizationServiceClient) OrganizationService {
	return &organizationService{client: client}
}

type organizationService struct {
	client organizationpb.OrganizationServiceClient
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
