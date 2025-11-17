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
	searchpb "github.com/aliirah/task-flow/shared/proto/search/v1"
)

type SearchService struct {
	rpcClient     searchpb.SearchServiceClient
	httpClient    *http.Client
	reindexURL    string
	internalToken string
}

func NewSearchService(rpcClient searchpb.SearchServiceClient, baseURL, internalToken string) *SearchService {
	if baseURL == "" {
		baseURL = "http://search-service:8080"
	}
	return &SearchService{
		rpcClient: rpcClient,
		httpClient: &http.Client{
			Timeout: 8 * time.Second,
		},
		reindexURL:    strings.TrimSuffix(baseURL, "/"),
		internalToken: internalToken,
	}
}

func (s *SearchService) Search(ctx context.Context, query string, types []string, limit int) (*contracts.SearchResponse, error) {
	if s.rpcClient == nil {
		return nil, fmt.Errorf("search client not configured")
	}

	req := &searchpb.SearchRequest{
		Query: query,
		Types: types,
		Limit: int32(limit),
	}
	resp, err := s.rpcClient.Search(ctx, req)
	if err != nil {
		return nil, err
	}

	results := make([]contracts.SearchResult, 0, len(resp.Results))
	for _, r := range resp.Results {
		if r == nil {
			continue
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

func (s *SearchService) Suggest(ctx context.Context, query string, limit int) ([]string, error) {
	if s.rpcClient == nil {
		return nil, fmt.Errorf("search client not configured")
	}

	resp, err := s.rpcClient.Suggest(ctx, &searchpb.SuggestRequest{
		Query: query,
		Limit: int32(limit),
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
