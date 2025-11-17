package grpcserver

import (
	"context"
	"fmt"

	"github.com/aliirah/task-flow/services/search-service/internal/search"
	"github.com/aliirah/task-flow/shared/contracts"
	searchpb "github.com/aliirah/task-flow/shared/proto/search/v1"
)

type Server struct {
	searchpb.UnimplementedSearchServiceServer
	searchSvc *search.Service
}

func New(searchSvc *search.Service) *Server {
	return &Server{searchSvc: searchSvc}
}

func (s *Server) Search(ctx context.Context, req *searchpb.SearchRequest) (*searchpb.SearchResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("missing request")
	}
	docTypes := search.ParseDocumentTypes(req.Types)
	resp, err := s.searchSvc.Search(ctx, req.Query, docTypes, int(req.Limit), req.OrganizationId, req.UserId)
	if err != nil {
		return nil, err
	}

	return convertToProtoResponse(resp), nil
}

func (s *Server) Suggest(ctx context.Context, req *searchpb.SuggestRequest) (*searchpb.SuggestResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("missing request")
	}
	results, err := s.searchSvc.Suggest(ctx, req.Query, int(req.Limit), req.OrganizationId, req.UserId)
	if err != nil {
		return nil, err
	}
	return &searchpb.SuggestResponse{Results: results}, nil
}

func convertToProtoResponse(resp *contracts.SearchResponse) *searchpb.SearchResponse {
	if resp == nil {
		return &searchpb.SearchResponse{}
	}
	results := make([]*searchpb.SearchResult, 0, len(resp.Results))
	for _, r := range resp.Results {
		results = append(results, &searchpb.SearchResult{
			Id:             r.ID,
			Type:           r.Type,
			Title:          r.Title,
			Summary:        r.Summary,
			Content:        r.Content,
			OrganizationId: r.OrganizationID,
			TaskId:         r.TaskID,
			UserId:         r.UserID,
			Email:          r.Email,
			Score:          r.Score,
			Metadata:       r.Metadata,
		})
	}
	return &searchpb.SearchResponse{
		Total:   resp.Total,
		Results: results,
	}
}
