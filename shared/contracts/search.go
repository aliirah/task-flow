package contracts

const (
	SearchTypeUser    = "user"
	SearchTypeTask    = "task"
	SearchTypeComment = "comment"
)

type SearchResult struct {
	ID             string            `json:"id"`
	Type           string            `json:"type"`
	Title          string            `json:"title"`
	Summary        string            `json:"summary,omitempty"`
	Content        string            `json:"content,omitempty"`
	OrganizationID string            `json:"organizationId,omitempty"`
	TaskID         string            `json:"taskId,omitempty"`
	UserID         string            `json:"userId,omitempty"`
	Email          string            `json:"email,omitempty"`
	Score          float64           `json:"score,omitempty"`
	Metadata       map[string]string `json:"metadata,omitempty"`
}

type SearchResponse struct {
	Total   int64          `json:"total"`
	Results []SearchResult `json:"results"`
}
