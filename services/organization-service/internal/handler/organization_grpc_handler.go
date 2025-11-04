package handler

import (
	"context"

	"github.com/aliirah/task-flow/services/organization-service/internal/models"
	"github.com/aliirah/task-flow/services/organization-service/internal/service"
	organizationpb "github.com/aliirah/task-flow/shared/proto/organization/v1"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	emptypb "google.golang.org/protobuf/types/known/emptypb"
	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
)

type OrganizationHandler struct {
	organizationpb.UnimplementedOrganizationServiceServer
	svc *service.Service
}

func NewOrganizationHandler(svc *service.Service) *OrganizationHandler {
	return &OrganizationHandler{svc: svc}
}

func (h *OrganizationHandler) CreateOrganization(ctx context.Context, req *organizationpb.CreateOrganizationRequest) (*organizationpb.Organization, error) {
	ownerID, err := parseUUID(req.GetOwnerId())
	if err != nil && req.GetOwnerId() != "" {
		return nil, status.Error(codes.InvalidArgument, "invalid owner id")
	}

	org, err := h.svc.CreateOrganization(ctx, service.CreateOrganizationInput{
		Name:        req.GetName(),
		Description: req.GetDescription(),
		OwnerID:     ownerID,
	})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return toProtoOrganization(org), nil
}

func (h *OrganizationHandler) GetOrganization(ctx context.Context, req *organizationpb.GetOrganizationRequest) (*organizationpb.Organization, error) {
	id, err := parseUUID(req.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid organization id")
	}
	org, err := h.svc.GetOrganization(ctx, id)
	if err != nil {
		if err == service.ErrOrganizationNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	return toProtoOrganization(org), nil
}

func (h *OrganizationHandler) ListOrganizations(ctx context.Context, req *organizationpb.ListOrganizationsRequest) (*organizationpb.ListOrganizationsResponse, error) {
	orgs, err := h.svc.ListOrganizations(ctx, service.ListOrganizationsParams{
		Query: req.GetQuery(),
		Page:  int(req.GetPage()),
		Limit: int(req.GetLimit()),
	})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	items := make([]*organizationpb.Organization, 0, len(orgs))
	for _, org := range orgs {
		items = append(items, toProtoOrganization(&org))
	}

	return &organizationpb.ListOrganizationsResponse{Items: items}, nil
}

func (h *OrganizationHandler) UpdateOrganization(ctx context.Context, req *organizationpb.UpdateOrganizationRequest) (*organizationpb.Organization, error) {
	id, err := parseUUID(req.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid organization id")
	}
	var namePtr, descPtr *string
	if req.GetName() != "" {
		name := req.GetName()
		namePtr = &name
	}
	if req.GetDescription() != "" {
		desc := req.GetDescription()
		descPtr = &desc
	}

	org, err := h.svc.UpdateOrganization(ctx, id, service.UpdateOrganizationInput{
		Name:        namePtr,
		Description: descPtr,
	})
	if err != nil {
		if err == service.ErrOrganizationNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	return toProtoOrganization(org), nil
}

func (h *OrganizationHandler) DeleteOrganization(ctx context.Context, req *organizationpb.DeleteOrganizationRequest) (*emptypb.Empty, error) {
	id, err := parseUUID(req.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid organization id")
	}
	if err := h.svc.DeleteOrganization(ctx, id); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &emptypb.Empty{}, nil
}

func (h *OrganizationHandler) AddMember(ctx context.Context, req *organizationpb.AddMemberRequest) (*organizationpb.OrganizationMember, error) {
	orgID, err := parseUUID(req.GetOrganizationId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid organization id")
	}
	userID, err := parseUUID(req.GetUserId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid user id")
	}
	member, err := h.svc.AddMember(ctx, service.AddMemberInput{
		OrganizationID: orgID,
		UserID:         userID,
		Role:           req.GetRole(),
	})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return toProtoMember(member), nil
}

func (h *OrganizationHandler) RemoveMember(ctx context.Context, req *organizationpb.RemoveMemberRequest) (*emptypb.Empty, error) {
	orgID, err := parseUUID(req.GetOrganizationId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid organization id")
	}
	userID, err := parseUUID(req.GetUserId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid user id")
	}
	if err := h.svc.RemoveMember(ctx, orgID, userID); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &emptypb.Empty{}, nil
}

func (h *OrganizationHandler) ListMembers(ctx context.Context, req *organizationpb.ListMembersRequest) (*organizationpb.ListMembersResponse, error) {
	orgID, err := parseUUID(req.GetOrganizationId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid organization id")
	}

	members, err := h.svc.ListMembers(ctx, service.ListMembersParams{
		OrganizationID: orgID,
		Page:           int(req.GetPage()),
		Limit:          int(req.GetLimit()),
	})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	items := make([]*organizationpb.OrganizationMember, 0, len(members))
	for _, member := range members {
		items = append(items, toProtoMember(&member))
	}

	return &organizationpb.ListMembersResponse{Items: items}, nil
}

func (h *OrganizationHandler) ListUserMemberships(ctx context.Context, req *organizationpb.ListUserMembershipsRequest) (*organizationpb.ListUserMembershipsResponse, error) {
	userID, err := parseUUID(req.GetUserId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid user id")
	}
	memberships, err := h.svc.ListUserMemberships(ctx, userID)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	items := make([]*organizationpb.OrganizationMember, 0, len(memberships))
	for _, member := range memberships {
		items = append(items, toProtoMember(&member))
	}

	return &organizationpb.ListUserMembershipsResponse{Memberships: items}, nil
}

func parseUUID(value string) (uuid.UUID, error) {
	if value == "" {
		return uuid.Nil, nil
	}
	return uuid.Parse(value)
}

func toProtoOrganization(org *models.Organization) *organizationpb.Organization {
	return &organizationpb.Organization{
		Id:          org.ID.String(),
		Name:        org.Name,
		Description: org.Description,
		OwnerId:     org.OwnerID.String(),
		CreatedAt:   timestamppb.New(org.CreatedAt),
		UpdatedAt:   timestamppb.New(org.UpdatedAt),
	}
}

func toProtoMember(member *models.OrganizationMember) *organizationpb.OrganizationMember {
	return &organizationpb.OrganizationMember{
		Id:             member.ID.String(),
		OrganizationId: member.OrganizationID.String(),
		UserId:         member.UserID.String(),
		Role:           member.Role,
		Status:         member.Status,
		CreatedAt:      timestamppb.New(member.CreatedAt),
	}
}
