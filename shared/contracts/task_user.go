package contracts

// TaskUser represents a user associated with a task (assignee or reporter)
type TaskUser struct {
	ID        string `json:"id"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`
}
