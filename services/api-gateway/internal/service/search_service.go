package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/aliirah/task-flow/shared/contracts"
)

type SearchService struct {
	client        *http.Client
	baseURL       string
	internalToken string
}

func NewSearchService(baseURL, internalToken string) *SearchService {
	if baseURL == "" {
		baseURL = "http://search-service:8080"
	}
	return &SearchService{
		client: &http.Client{
			Timeout: 8 * time.Second,
		},
		baseURL:       strings.TrimSuffix(baseURL, "/"),
		internalToken: internalToken,
	}
}

func (s *SearchService) Search(ctx context.Context, query string, types []string, limit int) (*contracts.SearchResponse, error) {
	params := url.Values{}
	params.Set("q", query)
	if limit > 0 {
		params.Set("limit", fmt.Sprintf("%d", limit))
	}
	if len(types) > 0 {
		params.Set("types", strings.Join(types, ","))
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/search?%s", s.baseURL, params.Encode()), nil)
	if err != nil {
		return nil, err
	}

	res, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("search service returned %s", res.Status)
	}

	var response contracts.SearchResponse
	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return nil, err
	}
	return &response, nil
}

func (s *SearchService) Suggest(ctx context.Context, query string, limit int) ([]string, error) {
	params := url.Values{}
	params.Set("q", query)
	if limit > 0 {
		params.Set("limit", fmt.Sprintf("%d", limit))
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/search/suggest?%s", s.baseURL, params.Encode()), nil)
	if err != nil {
		return nil, err
	}

	res, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("suggest service returned %s", res.Status)
	}

	var payload struct {
		Results []string `json:"results"`
	}
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return nil, err
	}
	return payload.Results, nil
}

func (s *SearchService) TriggerReindex(ctx context.Context, types []string) error {
	if s.internalToken == "" {
		return fmt.Errorf("internal token not configured")
	}

	body := map[string][]string{
		"types": types,
	}
	payload, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/internal/reindex", s.baseURL), bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", s.internalToken)

	res, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("reindex returned %s", res.Status)
	}
	return nil
}
