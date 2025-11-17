package jsoncodec

import (
	"encoding/json"
	"sync"

	"google.golang.org/grpc/encoding"
)

const Name = "json"

type codec struct{}

func (codec) Name() string {
	return Name
}

func (codec) Marshal(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}

func (codec) Unmarshal(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}

var (
	registerOnce sync.Once
)

// Register ensures the JSON codec is registered exactly once.
func Register() {
	registerOnce.Do(func() {
		encoding.RegisterCodec(codec{})
	})
}

// Codec returns the codec instance for explicit server overrides.
func Codec() encoding.Codec {
	return codec{}
}
