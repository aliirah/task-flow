package task

// Package task provides shared task domain constants used across services.

var (
	// StatusSet defines the allowed task statuses recognised across services.
	StatusSet = newStringSet("open", "in_progress", "completed", "blocked", "cancelled")
	// PrioritySet defines the allowed task priorities recognised across services.
	PrioritySet = newStringSet("low", "medium", "high", "critical")
)

func newStringSet(values ...string) map[string]struct{} {
	set := make(map[string]struct{}, len(values))
	for _, v := range values {
		set[v] = struct{}{}
	}
	return set
}
