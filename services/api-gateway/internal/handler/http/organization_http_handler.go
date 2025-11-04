package http

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/aliirah/task-flow/services/api-gateway/internal/service"
	"github.com/aliirah/task-flow/shared/authctx"
	organizationpb "github.com/aliirah/task-flow/shared/proto/organization/v1"
	"github.com/aliirah/task-flow/shared/rest"
	"github.com/aliirah/task-flow/shared/util"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
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
	type payload struct {
		Name        string `json:"name" validate:"required,min=2"`
		Description string `json:"description" validate:"omitempty,max=1024"`
	}

	var body payload
	if err := c.ShouldBindJSON(&body); err != nil {
		rest.Error(c, http.StatusBadRequest, "invalid request payload",
			rest.WithErrorCode("validation.invalid_payload"))
		return
	}
	if err := h.validator.Struct(body); err != nil {
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

	req := &organizationpb.CreateOrganizationRequest{
		Name:        strings.TrimSpace(body.Name),
		Description: strings.TrimSpace(body.Description),
		OwnerId:     currentUser.ID,
	}

	org, err := h.orgService.Create(c.Request.Context(), req)
	if err != nil {
		writeOrganizationError(c, err)
		return
	}

	rest.Created(c, organizationToMap(org))
}

func (h *OrganizationHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	resp, err := h.orgService.List(c.Request.Context(), &organizationpb.ListOrganizationsRequest{
		Query: c.Query("q"),
		Page:  int32(page),
		Limit: int32(limit),
	})
	if err != nil {
		writeOrganizationError(c, err)
		return
	}

	items := make([]gin.H, 0, len(resp.GetItems()))
	for _, org := range resp.GetItems() {
		items = append(items, organizationToMap(org))
	}
	rest.Ok(c, gin.H{"items": items})
}

func (h *OrganizationHandler) Get(c *gin.Context) {
	org, err := h.orgService.Get(c.Request.Context(), c.Param("id"))
	if err != nil {
		writeOrganizationError(c, err)
		return
	}
	rest.Ok(c, organizationToMap(org))
}

func (h *OrganizationHandler) Update(c *gin.Context) {
	type payload struct {
		Name        *string `json:"name" validate:"omitempty,min=2"`
		Description *string `json:"description" validate:"omitempty,max=1024"`
	}
	var body payload
	if err := c.ShouldBindJSON(&body); err != nil {
		rest.Error(c, http.StatusBadRequest, "invalid request payload",
			rest.WithErrorCode("validation.invalid_payload"))
		return
	}
	if err := h.validator.Struct(body); err != nil {
		rest.Error(c, http.StatusBadRequest, "validation failed",
			rest.WithErrorCode("validation.failed"),
			rest.WithErrorDetails(util.CollectValidationErrors(err)))
		return
	}

	req := &organizationpb.UpdateOrganizationRequest{
		Id:          c.Param("id"),
		Name:        getString(body.Name),
		Description: getString(body.Description),
	}

	org, err := h.orgService.Update(c.Request.Context(), req)
	if err != nil {
		writeOrganizationError(c, err)
		return
	}
	rest.Ok(c, organizationToMap(org))
}

func (h *OrganizationHandler) Delete(c *gin.Context) {
	if err := h.orgService.Delete(c.Request.Context(), &organizationpb.DeleteOrganizationRequest{Id: c.Param("id")}); err != nil {
		writeOrganizationError(c, err)
		return
	}
	rest.NoContent(c)
}

func (h *OrganizationHandler) AddMember(c *gin.Context) {
	type payload struct {
		UserID string `json:"userId" validate:"required,uuid4"`
		Role   string `json:"role" validate:"omitempty,oneof=owner admin member"`
	}
	var body payload
	if err := c.ShouldBindJSON(&body); err != nil {
		rest.Error(c, http.StatusBadRequest, "invalid request payload",
			rest.WithErrorCode("validation.invalid_payload"))
		return
	}
	if err := h.validator.Struct(body); err != nil {
		rest.Error(c, http.StatusBadRequest, "validation failed",
			rest.WithErrorCode("validation.failed"),
			rest.WithErrorDetails(util.CollectValidationErrors(err)))
		return
	}

	req := &organizationpb.AddMemberRequest{
		OrganizationId: c.Param("id"),
		UserId:         body.UserID,
		Role:           strings.TrimSpace(body.Role),
	}

	member, err := h.orgService.AddMember(c.Request.Context(), req)
	if err != nil {
		writeOrganizationError(c, err)
		return
	}

	rest.Ok(c, memberToMap(member))
}

func (h *OrganizationHandler) RemoveMember(c *gin.Context) {
	req := &organizationpb.RemoveMemberRequest{
		OrganizationId: c.Param("id"),
		UserId:         c.Param("userId"),
	}
	if err := h.orgService.RemoveMember(c.Request.Context(), req); err != nil {
		writeOrganizationError(c, err)
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
	if err != nil {
		writeOrganizationError(c, err)
		return
	}

	payload, err := h.enrichMembers(c.Request.Context(), resp.GetItems())
	if err != nil {
		writeOrganizationError(c, err)
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
	if err != nil {
		writeOrganizationError(c, err)
		return
	}

	payload, err := h.enrichMembers(c.Request.Context(), resp.GetMemberships())
	if err != nil {
		writeOrganizationError(c, err)
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
		item := memberToMap(member)
		if user := userMap[member.GetUserId()]; user != nil {
			item["user"] = map[string]interface{}{
				"id":        user.GetId(),
				"email":     user.GetEmail(),
				"firstName": user.GetFirstName(),
				"lastName":  user.GetLastName(),
				"status":    user.GetStatus(),
				"userType":  user.GetUserType(),
				"roles":     user.GetRoles(),
			}
		} else {
			item["user"] = map[string]interface{}{
				"id":        member.GetUserId(),
				"email":     "",
				"firstName": "",
				"lastName":  "",
				"status":    "",
				"userType":  "",
				"roles":     []string{},
			}
		}
		if org := orgMap[member.GetOrganizationId()]; org != nil {
			item["organization"] = organizationToMap(org)
		}
		items = append(items, item)
	}
	return items, nil
}

func writeOrganizationError(c *gin.Context, err error) {
	if err == nil {
		return
	}
	if st, ok := status.FromError(err); ok {
		switch st.Code() {
		case codes.InvalidArgument, codes.FailedPrecondition:
			rest.Error(c, http.StatusBadRequest, st.Message(),
				rest.WithErrorCode("organization.invalid_request"))
		case codes.NotFound:
			rest.Error(c, http.StatusNotFound, st.Message(),
				rest.WithErrorCode("organization.not_found"))
		case codes.PermissionDenied:
			rest.Error(c, http.StatusForbidden, st.Message(),
				rest.WithErrorCode("organization.forbidden"))
		case codes.AlreadyExists:
			rest.Error(c, http.StatusConflict, st.Message(),
				rest.WithErrorCode("organization.already_exists"))
		case codes.Unauthenticated:
			rest.Error(c, http.StatusUnauthorized, st.Message(),
				rest.WithErrorCode("organization.unauthenticated"))
		default:
			rest.Error(c, http.StatusBadGateway, "organization service error",
				rest.WithErrorCode("organization.service_error"),
				rest.WithErrorDetails(st.Message()))
		}
		return
	}

	rest.Error(c, http.StatusBadGateway, "organization service unavailable",
		rest.WithErrorCode("organization.unavailable"),
		rest.WithErrorDetails(err.Error()))
}

func organizationToMap(org *organizationpb.Organization) gin.H {
	if org == nil {
		return gin.H{}
	}
	return gin.H{
		"id":          org.GetId(),
		"name":        org.GetName(),
		"description": org.GetDescription(),
		"ownerId":     org.GetOwnerId(),
		"createdAt":   timestampToString(org.GetCreatedAt()),
		"updatedAt":   timestampToString(org.GetUpdatedAt()),
	}
}

func memberToMap(member *organizationpb.OrganizationMember) gin.H {
	if member == nil {
		return gin.H{}
	}
	return gin.H{
		"id":             member.GetId(),
		"organizationId": member.GetOrganizationId(),
		"userId":         member.GetUserId(),
		"role":           member.GetRole(),
		"status":         member.GetStatus(),
		"createdAt":      timestampToString(member.GetCreatedAt()),
	}
}

func timestampToString(ts *timestamppb.Timestamp) string {
	if ts == nil {
		return ""
	}
	return ts.AsTime().UTC().Format(time.RFC3339)
}

func getString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
