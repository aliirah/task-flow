package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aliirah/task-flow/shared/contracts"
	organizationpb "github.com/aliirah/task-flow/shared/proto/organization/v1"
	searchpb "github.com/aliirah/task-flow/shared/proto/search/v1"
)

type SearchService struct {
	rpcClient     searchpb.SearchServiceClient
	httpClient    *http.Client
	reindexURL    string
	internalToken string
	orgService    OrganizationMembershipService
}

type OrganizationMembershipService interface {
	ListUserMemberships(ctx context.Context, req *organizationpb.ListUserMembershipsRequest) (*organizationpb.ListUserMembershipsResponse, error)
}

func NewSearchService(rpcClient searchpb.SearchServiceClient, orgService OrganizationMembershipService, baseURL, internalToken string) *SearchService {
	if baseURL == "" {
		baseURL = "http://search-service:8080"
	}
	return &SearchService{
		rpcClient:  rpcClient,
		orgService: orgService,
		httpClient: &http.Client{
			Timeout: 8 * time.Second,
		},
		reindexURL:    strings.TrimSuffix(baseURL, "/"),
		internalToken: internalToken,
	}
}

func (s *SearchService) Search(ctx context.Context, query string, types []string, limit int, organizationID, userID string) (*contracts.SearchResponse, error) {
	if s.rpcClient == nil {
		return nil, fmt.Errorf("search client not configured")
	}

	req := &searchpb.SearchRequest{
		Query:          query,
		Types:          types,
		Limit:          int32(limit),
		OrganizationId: organizationID,
		UserId:         userID,
	}
	resp, err := s.rpcClient.Search(ctx, req)
	if err != nil {
		return nil, err
	}

	results := make([]contracts.SearchResult, 0, len(resp.Results))
	membershipCache := map[string]bool{}
	for _, r := range resp.Results {
		if r == nil {
			continue
		}
		if r.GetType() == contracts.SearchTypeUser && organizationID != "" && s.orgService != nil {
			if allowed, ok := membershipCache[r.GetId()]; ok {
				if !allowed {
					continue
				}
			} else {
				allowed := s.userBelongsToOrg(ctx, r.GetId(), organizationID)
				membershipCache[r.GetId()] = allowed
				if !allowed {
					continue
				}
			}
		}
		results = append(results, contracts.SearchResult{
			ID:             r.Id,
			Type:           r.Type,
			Title:          r.Title,
			Summary:        r.Summary,
			Content:        r.Content,
			OrganizationID: r.OrganizationId,
			TaskID:         r.TaskId,
			UserID:         r.UserId,
			Email:          r.Email,
			Score:          r.Score,
			Metadata:       r.Metadata,
		})
	}

	return &contracts.SearchResponse{
		Total:   resp.Total,
		Results: results,
	}, nil
}

func (s *SearchService) Suggest(ctx context.Context, query string, limit int, organizationID, userID string) ([]string, error) {
	if s.rpcClient == nil {
		return nil, fmt.Errorf("search client not configured")
	}

	resp, err := s.rpcClient.Suggest(ctx, &searchpb.SuggestRequest{
		Query:          query,
		Limit:          int32(limit),
		OrganizationId: organizationID,
		UserId:         userID,
	})
	if err != nil {
		return nil, err
	}
	return resp.Results, nil
}

func (s *SearchService) TriggerReindex(ctx context.Context, types []string) error {
	if s.internalToken == "" {
		return fmt.Errorf("internal token not configured")
	}

	body := map[string][]string{
		"types": types,
	}
	payload, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/internal/reindex", s.reindexURL), bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", s.internalToken)

	res, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("reindex returned %s", res.Status)
	}
	return nil
}

func (s *SearchService) userBelongsToOrg(ctx context.Context, userID, organizationID string) bool {
	if userID == "" || organizationID == "" || s.orgService == nil {
		return false
	}

	ctx = withOutgoingAuth(ctx)
	resp, err := s.orgService.ListUserMemberships(ctx, &organizationpb.ListUserMembershipsRequest{
		UserId: userID,
	})
	if err != nil {
		return false
	}

	for _, m := range resp.GetMemberships() {
		if m.GetOrganizationId() == organizationID {
			return true
		}
	}
	return false
}
