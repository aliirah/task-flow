package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// HTTPRequestDuration tracks the duration of HTTP requests
	HTTPRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "http_request_duration_seconds",
			Help: "Duration of HTTP requests in seconds",
			Buckets: []float64{
				0.0005, // 0.5ms
				0.001,  // 1ms
				0.002,  // 2ms
				0.005,  // 5ms
				0.01,   // 10ms
				0.02,   // 20ms
				0.05,   // 50ms
				0.1,    // 100ms
				0.2,    // 200ms
				0.5,    // 500ms
				1,      // 1s
				2,      // 2s
				5,      // 5s
			},
		},
		[]string{"handler", "method", "status"},
	)

	// HTTPRequestTotal tracks the total number of requests
	HTTPRequestTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"handler", "method", "status"},
	)

	// GRPCRequestDuration tracks the duration of gRPC requests
	GRPCRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "grpc_request_duration_seconds",
			Help: "Duration of gRPC requests in seconds",
			Buckets: []float64{
				0.001, // 1ms
				0.002, // 2ms
				0.005, // 5ms
				0.01,  // 10ms
				0.02,  // 20ms
				0.05,  // 50ms
				0.1,   // 100ms
				0.2,   // 200ms
				0.5,   // 500ms
				1,     // 1s
				2,     // 2s
				5,     // 5s
			},
		},
		[]string{"method", "status"},
	)

	// GRPCRequestTotal tracks the total number of gRPC requests
	GRPCRequestTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grpc_requests_total",
			Help: "Total number of gRPC requests",
		},
		[]string{"method", "status"},
	)

	// RabbitMQMessageDuration tracks the duration of message processing
	RabbitMQMessageDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "rabbitmq_message_processing_duration_seconds",
			Help: "Duration of RabbitMQ message processing in seconds",
			Buckets: []float64{
				0.001, // 1ms
				0.002, // 2ms
				0.005, // 5ms
				0.01,  // 10ms
				0.02,  // 20ms
				0.05,  // 50ms
				0.1,   // 100ms
				0.2,   // 200ms
				0.5,   // 500ms
				1,     // 1s
				2,     // 2s
				5,     // 5s
			},
		},
		[]string{"queue", "event_type", "status"},
	)

	// RabbitMQMessageTotal tracks the total number of processed messages
	RabbitMQMessageTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "rabbitmq_messages_total",
			Help: "Total number of RabbitMQ messages processed",
		},
		[]string{"queue", "event_type", "status"},
	)

	// RabbitMQMessageSize tracks the size of messages
	RabbitMQMessageSize = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "rabbitmq_message_size_bytes",
			Help: "Size of RabbitMQ messages in bytes",
			Buckets: []float64{
				100,    // 100B
				500,    // 500B
				1000,   // 1KB
				5000,   // 5KB
				10000,  // 10KB
				50000,  // 50KB
				100000, // 100KB
				500000, // 500KB
				1e6,    // 1MB
			},
		},
		[]string{"queue", "event_type"},
	)
)
