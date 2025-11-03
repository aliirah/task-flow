package util

import (
	"fmt"

	"github.com/go-playground/validator/v10"
)

func NewValidator() *validator.Validate {
	return validator.New()
}

func CollectValidationErrors(err error) []string {
	if err == nil {
		return nil
	}

	validationErrs, ok := err.(validator.ValidationErrors)
	if !ok {
		return []string{err.Error()}
	}

	out := make([]string, 0, len(validationErrs))
	for _, ve := range validationErrs {
		field := ve.Field()
		tag := ve.Tag()
		var message string

		switch tag {
		case "required":
			message = fmt.Sprintf("%s is required", field)
		case "min":
			message = fmt.Sprintf("%s must be at least %s characters long", field, ve.Param())
		case "max":
			message = fmt.Sprintf("%s must be at most %s characters long", field, ve.Param())
		case "email":
			message = fmt.Sprintf("%s must be a valid email address", field)
		case "oneof":
			message = fmt.Sprintf("%s must be one of [%s]", field, ve.Param())
		default:
			message = fmt.Sprintf("%s failed validation (%s)", field, tag)
		}

		out = append(out, message)
	}

	return out
}
