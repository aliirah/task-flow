package searchpb

import (
	"context"

	"google.golang.org/grpc"
)

const (
	ServiceName = "search.v1.SearchService"
)

type SearchRequest struct {
	Query string   `json:"query"`
	Types []string `json:"types"`
	Limit int32    `json:"limit"`
}

type SearchResult struct {
	Id             string            `json:"id"`
	Type           string            `json:"type"`
	Title          string            `json:"title"`
	Summary        string            `json:"summary,omitempty"`
	Content        string            `json:"content,omitempty"`
	OrganizationId string            `json:"organizationId,omitempty"`
	TaskId         string            `json:"taskId,omitempty"`
	UserId         string            `json:"userId,omitempty"`
	Email          string            `json:"email,omitempty"`
	Score          float64           `json:"score,omitempty"`
	Metadata       map[string]string `json:"metadata,omitempty"`
}

type SearchResponse struct {
	Total   int64          `json:"total"`
	Results []SearchResult `json:"results"`
}

type SuggestRequest struct {
	Query string `json:"query"`
	Limit int32  `json:"limit"`
}

type SuggestResponse struct {
	Results []string `json:"results"`
}

type SearchServiceClient interface {
	Search(ctx context.Context, in *SearchRequest, opts ...grpc.CallOption) (*SearchResponse, error)
	Suggest(ctx context.Context, in *SuggestRequest, opts ...grpc.CallOption) (*SuggestResponse, error)
}

type searchServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewSearchServiceClient(cc grpc.ClientConnInterface) SearchServiceClient {
	return &searchServiceClient{cc}
}

func (c *searchServiceClient) Search(ctx context.Context, in *SearchRequest, opts ...grpc.CallOption) (*SearchResponse, error) {
	out := new(SearchResponse)
	err := c.cc.Invoke(ctx, "/"+ServiceName+"/Search", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *searchServiceClient) Suggest(ctx context.Context, in *SuggestRequest, opts ...grpc.CallOption) (*SuggestResponse, error) {
	out := new(SuggestResponse)
	err := c.cc.Invoke(ctx, "/"+ServiceName+"/Suggest", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

type SearchServiceServer interface {
	Search(context.Context, *SearchRequest) (*SearchResponse, error)
	Suggest(context.Context, *SuggestRequest) (*SuggestResponse, error)
}

func RegisterSearchServiceServer(s grpc.ServiceRegistrar, srv SearchServiceServer) {
	s.RegisterService(&SearchService_ServiceDesc, srv)
}

var SearchService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: ServiceName,
	HandlerType: (*SearchServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "Search",
			Handler:    _SearchService_Search_Handler,
		},
		{
			MethodName: "Suggest",
			Handler:    _SearchService_Suggest_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "search_service",
}

func _SearchService_Search_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(SearchRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SearchServiceServer).Search(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/" + ServiceName + "/Search",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SearchServiceServer).Search(ctx, req.(*SearchRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _SearchService_Suggest_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(SuggestRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SearchServiceServer).Suggest(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/" + ServiceName + "/Suggest",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SearchServiceServer).Suggest(ctx, req.(*SuggestRequest))
	}
	return interceptor(ctx, in, info, handler)
}
