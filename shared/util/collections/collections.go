package collections

// MapKeys extracts keys from a set represented as map[string]struct{}.
func MapKeys(set map[string]struct{}) []string {
	keys := make([]string, 0, len(set))
	for k := range set {
		keys = append(keys, k)
	}
	return keys
}
