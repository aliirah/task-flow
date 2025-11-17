package search

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/aliirah/task-flow/shared/contracts"
)

type DocumentType string

const (
	DocumentTypeUser    DocumentType = DocumentType(contracts.SearchTypeUser)
	DocumentTypeTask    DocumentType = DocumentType(contracts.SearchTypeTask)
	DocumentTypeComment DocumentType = DocumentType(contracts.SearchTypeComment)
)

type Document struct {
	ID             string            `json:"id"`
	Type           DocumentType      `json:"type"`
	OrganizationID string            `json:"organizationId,omitempty"`
	Title          string            `json:"title"`
	Summary        string            `json:"summary,omitempty"`
	Content        string            `json:"content,omitempty"`
	Email          string            `json:"email,omitempty"`
	TaskID         string            `json:"taskId,omitempty"`
	UserID         string            `json:"userId,omitempty"`
	Suggest        []string          `json:"suggest,omitempty"`
	Metadata       map[string]string `json:"metadata,omitempty"`
}

type Service struct {
	endpoint  string
	indexName string
	client    *http.Client
}

func NewService(endpoint, indexName string) *Service {
	if indexName == "" {
		indexName = "taskflow_search"
	}
	return &Service{
		endpoint:  strings.TrimSuffix(endpoint, "/"),
		indexName: indexName,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (s *Service) EnsureIndex(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, fmt.Sprintf("%s/%s", s.endpoint, s.indexName), nil)
	if err != nil {
		return err
	}

	res, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusNotFound {
		return nil
	}

	mapping := map[string]interface{}{
		"settings": map[string]interface{}{
			"analysis": map[string]interface{}{
				"analyzer": map[string]interface{}{
					"autocomplete": map[string]interface{}{
						"type":      "custom",
						"tokenizer": "standard",
						"filter": []string{
							"lowercase",
							"edge_ngram",
						},
					},
				},
				"filter": map[string]interface{}{
					"edge_ngram": map[string]interface{}{
						"type":     "edge_ngram",
						"min_gram": 2,
						"max_gram": 20,
					},
				},
			},
		},
		"mappings": map[string]interface{}{
			"properties": map[string]interface{}{
				"type":           map[string]interface{}{"type": "keyword"},
				"organizationId": map[string]interface{}{"type": "keyword"},
				"title":          map[string]interface{}{"type": "text", "analyzer": "autocomplete", "search_analyzer": "standard"},
				"summary":        map[string]interface{}{"type": "text"},
				"content":        map[string]interface{}{"type": "text"},
				"email":          map[string]interface{}{"type": "keyword"},
				"suggest":        map[string]interface{}{"type": "completion"},
				"taskId":         map[string]interface{}{"type": "keyword"},
				"userId":         map[string]interface{}{"type": "keyword"},
				"metadata":       map[string]interface{}{"type": "object"},
			},
		},
	}

	payload, _ := json.Marshal(mapping)
	putReq, err := http.NewRequestWithContext(ctx, http.MethodPut, fmt.Sprintf("%s/%s", s.endpoint, s.indexName), bytes.NewReader(payload))
	if err != nil {
		return err
	}
	putReq.Header.Set("Content-Type", "application/json")

	createRes, err := s.client.Do(putReq)
	if err != nil {
		return err
	}
	defer createRes.Body.Close()

	if createRes.StatusCode >= 300 {
		body, _ := io.ReadAll(createRes.Body)
		return fmt.Errorf("create index failed: %s", string(body))
	}
	return nil
}

func (s *Service) UpsertDocument(ctx context.Context, doc Document) error {
	docID := s.documentID(doc.Type, doc.ID)
	if len(doc.Suggest) == 0 {
		doc.Suggest = s.defaultSuggest(doc)
	}
	payload, _ := json.Marshal(doc)

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, fmt.Sprintf("%s/%s/_doc/%s", s.endpoint, s.indexName, docID), bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode >= 300 {
		body, _ := io.ReadAll(res.Body)
		return fmt.Errorf("index error: %s", string(body))
	}
	return nil
}

func (s *Service) DeleteDocument(ctx context.Context, docType DocumentType, id string) error {
	docID := s.documentID(docType, id)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, fmt.Sprintf("%s/%s/_doc/%s", s.endpoint, s.indexName, docID), nil)
	if err != nil {
		return err
	}

	res, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode == http.StatusNotFound {
		return nil
	}

	if res.StatusCode >= 300 {
		body, _ := io.ReadAll(res.Body)
		return fmt.Errorf("delete error: %s", string(body))
	}
	return nil
}

func (s *Service) Search(ctx context.Context, query string, types []DocumentType, limit int) (*contracts.SearchResponse, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	body := map[string]interface{}{
		"size": limit,
		"query": map[string]interface{}{
			"bool": map[string]interface{}{
				"must": []interface{}{
					map[string]interface{}{
						"multi_match": map[string]interface{}{
							"query":  query,
							"fields": []string{"title^3", "summary^2", "content", "email"},
						},
					},
				},
			},
		},
		"highlight": map[string]interface{}{
			"fields": map[string]interface{}{
				"content": map[string]interface{}{},
				"summary": map[string]interface{}{},
			},
		},
	}

	if len(types) > 0 {
		typeStrings := make([]string, 0, len(types))
		for _, t := range types {
			if t != "" {
				typeStrings = append(typeStrings, string(t))
			}
		}
		if len(typeStrings) > 0 {
			boolQuery := body["query"].(map[string]interface{})["bool"].(map[string]interface{})
			boolQuery["filter"] = []interface{}{
				map[string]interface{}{
					"terms": map[string]interface{}{
						"type": typeStrings,
					},
				},
			}
		}
	}

	payload, _ := json.Marshal(body)
	res, err := s.performRequest(ctx, http.MethodPost, fmt.Sprintf("%s/%s/_search", s.endpoint, s.indexName), payload)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("search error: %s", string(bodyBytes))
	}

	var result struct {
		Hits struct {
			Total struct {
				Value int64 `json:"value"`
			} `json:"total"`
			Hits []struct {
				Score     *float64            `json:"_score"`
				Source    Document            `json:"_source"`
				Highlight map[string][]string `json:"highlight"`
			} `json:"hits"`
		} `json:"hits"`
	}

	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return nil, err
	}

	response := &contracts.SearchResponse{
		Total:   result.Hits.Total.Value,
		Results: make([]contracts.SearchResult, 0, len(result.Hits.Hits)),
	}

	for _, hit := range result.Hits.Hits {
		doc := hit.Source
		summary := doc.Summary
		if hl, ok := hit.Highlight["content"]; ok && len(hl) > 0 {
			summary = strings.Join(hl, " ... ")
		}
		resultItem := contracts.SearchResult{
			ID:             doc.ID,
			Type:           string(doc.Type),
			Title:          doc.Title,
			Summary:        summary,
			Content:        doc.Content,
			OrganizationID: doc.OrganizationID,
			TaskID:         doc.TaskID,
			UserID:         doc.UserID,
			Email:          doc.Email,
			Metadata:       doc.Metadata,
		}
		if hit.Score != nil {
			resultItem.Score = *hit.Score
		}
		response.Results = append(response.Results, resultItem)
	}

	return response, nil
}

func (s *Service) Suggest(ctx context.Context, query string, limit int) ([]string, error) {
	if limit <= 0 || limit > 20 {
		limit = 8
	}

	body := map[string]interface{}{
		"suggest": map[string]interface{}{
			"autocomplete": map[string]interface{}{
				"prefix": query,
				"completion": map[string]interface{}{
					"field":           "suggest",
					"size":            limit,
					"skip_duplicates": true,
				},
			},
		},
	}
	payload, _ := json.Marshal(body)
	res, err := s.performRequest(ctx, http.MethodPost, fmt.Sprintf("%s/%s/_search", s.endpoint, s.indexName), payload)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("suggest error: %s", string(bodyBytes))
	}

	var parsed struct {
		Suggest map[string][]struct {
			Options []struct {
				Text string `json:"text"`
			} `json:"options"`
		} `json:"suggest"`
	}
	if err := json.NewDecoder(res.Body).Decode(&parsed); err != nil {
		return nil, err
	}

	options := parsed.Suggest["autocomplete"]
	results := make([]string, 0, len(options))
	for _, option := range options {
		for _, opt := range option.Options {
			if opt.Text != "" {
				results = append(results, opt.Text)
			}
		}
	}
	return results, nil
}

func (s *Service) performRequest(ctx context.Context, method, url string, payload []byte) (*http.Response, error) {
	var body io.Reader
	if payload != nil {
		body = bytes.NewReader(payload)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return s.client.Do(req)
}

func (s *Service) documentID(docType DocumentType, id string) string {
	return fmt.Sprintf("%s:%s", docType, id)
}

func (s *Service) defaultSuggest(doc Document) []string {
	suggestions := []string{}
	if doc.Title != "" {
		suggestions = append(suggestions, doc.Title)
	}
	if doc.Email != "" {
		suggestions = append(suggestions, doc.Email)
	}
	if doc.Summary != "" {
		suggestions = append(suggestions, doc.Summary)
	}
	return suggestions
}
