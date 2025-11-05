package http

import (
	"context"
	"net/http"
	"strconv"

	"github.com/aliirah/task-flow/services/api-gateway/internal/dto"
	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
	"github.com/aliirah/task-flow/shared/authctx"
	organizationpb "github.com/aliirah/task-flow/shared/proto/organization/v1"
	"github.com/aliirah/task-flow/shared/rest"
	orgtransform "github.com/aliirah/task-flow/shared/transform/organization"
	usertransform "github.com/aliirah/task-flow/shared/transform/user"
	"github.com/aliirah/task-flow/shared/util"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type OrganizationHandler struct {
	orgService  service.OrganizationService
	userService service.UserService
	validator   *validator.Validate
}

func NewOrganizationHandler(orgSvc service.OrganizationService, userSvc service.UserService) *OrganizationHandler {
	return &OrganizationHandler{
		orgService:  orgSvc,
		userService: userSvc,
		validator:   util.NewValidator(),
	}
}

func (h *OrganizationHandler) Create(c *gin.Context) {
	var payload dto.OrganizationCreatePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		rest.Error(c, http.StatusBadRequest, "invalid request payload",
			rest.WithErrorCode("validation.invalid_payload"))
		return
	}
	if err := h.validator.Struct(payload); err != nil {
		rest.Error(c, http.StatusBadRequest, "validation failed",
			rest.WithErrorCode("validation.failed"),
			rest.WithErrorDetails(util.CollectValidationErrors(err)))
		return
	}

	currentUser, ok := authctx.UserFromGin(c)
	if !ok || currentUser.ID == "" {
		rest.Error(c, http.StatusUnauthorized, "missing user identity",
			rest.WithErrorCode("auth.missing_identity"))
		return
	}

	req := payload.Build(currentUser.ID)

	org, err := h.orgService.Create(c.Request.Context(), req)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("organization")) {
		return
	}

	rest.Created(c, orgtransform.ToMap(org))
}

func (h *OrganizationHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	resp, err := h.orgService.List(c.Request.Context(), &organizationpb.ListOrganizationsRequest{
		Query: c.Query("q"),
		Page:  int32(page),
		Limit: int32(limit),
	})
	if rest.HandleGRPCError(c, err, rest.WithNamespace("organization")) {
		return
	}

	items := make([]gin.H, 0, len(resp.GetItems()))
	for _, org := range resp.GetItems() {
		items = append(items, orgtransform.ToMap(org))
	}
	rest.Ok(c, gin.H{"items": items})
}

func (h *OrganizationHandler) Get(c *gin.Context) {
	org, err := h.orgService.Get(c.Request.Context(), c.Param("id"))
	if rest.HandleGRPCError(c, err, rest.WithNamespace("organization")) {
		return
	}
	rest.Ok(c, orgtransform.ToMap(org))
}

func (h *OrganizationHandler) Update(c *gin.Context) {
	var payload dto.OrganizationUpdatePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		rest.Error(c, http.StatusBadRequest, "invalid request payload",
			rest.WithErrorCode("validation.invalid_payload"))
		return
	}
	if err := h.validator.Struct(payload); err != nil {
		rest.Error(c, http.StatusBadRequest, "validation failed",
			rest.WithErrorCode("validation.failed"),
			rest.WithErrorDetails(util.CollectValidationErrors(err)))
		return
	}

	req := payload.Build(c.Param("id"))

	org, err := h.orgService.Update(c.Request.Context(), req)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("organization")) {
		return
	}
	rest.Ok(c, orgtransform.ToMap(org))
}

func (h *OrganizationHandler) Delete(c *gin.Context) {
	if rest.HandleGRPCError(c, h.orgService.Delete(c.Request.Context(), &organizationpb.DeleteOrganizationRequest{Id: c.Param("id")}), rest.WithNamespace("organization")) {
		return
	}
	rest.NoContent(c)
}

func (h *OrganizationHandler) AddMember(c *gin.Context) {
	var payload dto.OrganizationAddMemberPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		rest.Error(c, http.StatusBadRequest, "invalid request payload",
			rest.WithErrorCode("validation.invalid_payload"))
		return
	}
	if err := h.validator.Struct(payload); err != nil {
		rest.Error(c, http.StatusBadRequest, "validation failed",
			rest.WithErrorCode("validation.failed"),
			rest.WithErrorDetails(util.CollectValidationErrors(err)))
		return
	}

	req := payload.Build(c.Param("id"))

	member, err := h.orgService.AddMember(c.Request.Context(), req)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("organization")) {
		return
	}

	rest.Ok(c, orgtransform.MemberToMap(member))
}

func (h *OrganizationHandler) RemoveMember(c *gin.Context) {
	req := &organizationpb.RemoveMemberRequest{
		OrganizationId: c.Param("id"),
		UserId:         c.Param("userId"),
	}
	if rest.HandleGRPCError(c, h.orgService.RemoveMember(c.Request.Context(), req), rest.WithNamespace("organization")) {
		return
	}
	rest.NoContent(c)
}

func (h *OrganizationHandler) ListMembers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	req := &organizationpb.ListMembersRequest{
		OrganizationId: c.Param("id"),
		Page:           int32(page),
		Limit:          int32(limit),
	}

	resp, err := h.orgService.ListMembers(c.Request.Context(), req)
	if rest.HandleGRPCError(c, err, rest.WithNamespace("organization")) {
		return
	}

	payload, err := h.enrichMembers(c.Request.Context(), resp.GetItems())
	if err != nil {
		if rest.HandleGRPCError(c, err, rest.WithNamespace("organization")) {
			return
		}
		rest.InternalError(c, err)
		return
	}

	rest.Ok(c, gin.H{"items": payload})
}

func (h *OrganizationHandler) ListUserMemberships(c *gin.Context) {
	user, ok := authctx.UserFromGin(c)
	if !ok || user.ID == "" {
		rest.Error(c, http.StatusUnauthorized, "missing user identity",
			rest.WithErrorCode("auth.missing_identity"))
		return
	}

	resp, err := h.orgService.ListUserMemberships(c.Request.Context(), &organizationpb.ListUserMembershipsRequest{
		UserId: user.ID,
	})
	if rest.HandleGRPCError(c, err, rest.WithNamespace("organization")) {
		return
	}

	payload, err := h.enrichMembers(c.Request.Context(), resp.GetMemberships())
	if err != nil {
		if rest.HandleGRPCError(c, err, rest.WithNamespace("organization")) {
			return
		}
		rest.InternalError(c, err)
		return
	}
	rest.Ok(c, gin.H{"items": payload})
}

func (h *OrganizationHandler) enrichMembers(ctx context.Context, members []*organizationpb.OrganizationMember) ([]gin.H, error) {
	if len(members) == 0 {
		return []gin.H{}, nil
	}

	userIDs := make([]string, 0, len(members))
	orgIDs := make(map[string]struct{})
	for _, member := range members {
		userIDs = append(userIDs, member.GetUserId())
		if orgID := member.GetOrganizationId(); orgID != "" {
			orgIDs[orgID] = struct{}{}
		}
	}

	users, err := h.userService.ListByIDs(ctx, userIDs)
	if err != nil {
		return nil, err
	}

	userMap := make(map[string]*service.User, len(users))
	for _, u := range users {
		userMap[u.GetId()] = u
	}

	for _, member := range members {
		userID := member.GetUserId()
		if _, exists := userMap[userID]; exists || userID == "" {
			continue
		}
		user, err := h.userService.Get(ctx, userID)
		if err != nil {
			if st, ok := status.FromError(err); ok && st.Code() == codes.NotFound {
				continue
			}
			return nil, err
		}
		userMap[userID] = user
	}

	orgMap := make(map[string]*organizationpb.Organization, len(orgIDs))
	for id := range orgIDs {
		org, err := h.orgService.Get(ctx, id)
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
