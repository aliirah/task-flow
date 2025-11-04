package stringset

import (
	"fmt"
	"sort"
	"strings"
)

// Normalize returns the trimmed, lowercased enum value if present or fallback otherwise.
func Normalize(value, field string, allowed map[string]struct{}, fallback string) (string, error) {
	value = strings.TrimSpace(strings.ToLower(value))
	if value == "" {
		return fallback, nil
	}
	if _, ok := allowed[value]; !ok {
		opts := make([]string, 0, len(allowed))
		for k := range allowed {
			opts = append(opts, k)
		}
		sort.Strings(opts)
		return "", fmt.Errorf("%s must be one of [%s]", field, strings.Join(opts, ", "))
	}
	return value, nil
}
