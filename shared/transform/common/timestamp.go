package common

import (
	"time"

	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
)

// TimestampToString renders protobuf timestamps using RFC3339 in UTC.
func TimestampToString(ts *timestamppb.Timestamp) string {
	if ts == nil {
		return ""
	}
	return ts.AsTime().UTC().Format(time.RFC3339)
}

// TimeToString converts a Go time into the same canonical string format.
func TimeToString(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}
