package faker

import (
	"math/rand"
	"strings"
	"time"
)

var (
	firstNames      = []string{"Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Heidi", "Ivan", "Judy"}
	lastNames       = []string{"Anderson", "Brown", "Clark", "Davis", "Edwards", "Franklin", "Garcia", "Harris", "Iverson", "Johnson"}
	domains         = []string{"example.com", "mail.com", "test.net", "demo.org"}
	companyPrefixes = []string{"Global", "Dynamic", "Bright", "Prime", "Next", "Blue", "Nova", "Vertex"}
	companySuffixes = []string{"Solutions", "Labs", "Systems", "Technologies", "Works", "Partners", "Group", "Collective"}
	sentenceWords   = []string{"scalable", "distributed", "innovative", "platform", "collaboration", "ecosystem", "workflow", "automation", "experience", "insights"}
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

func randomFrom(list []string) string {
	return list[rand.Intn(len(list))]
}

// Email returns a pseudo-random email address.
func Email() string {
	return Username() + "@" + randomFrom(domains)
}

// Username returns a pseudo-random username string.
func Username() string {
	return randomFrom(firstNames) + "." + randomFrom(lastNames)
}

// FirstName returns a pseudo-random first name.
func FirstName() string {
	return randomFrom(firstNames)
}

// LastName returns a pseudo-random last name.
func LastName() string {
	return randomFrom(lastNames)
}

// Password returns a pseudo-random password value.
func Password() string {
	return randomFrom(firstNames) + randomFrom(lastNames) + "#" + randomDigits(4)
}

// Company returns a pseudo-random company name.
func Company() string {
	return randomFrom(companyPrefixes) + " " + randomFrom(companySuffixes)
}

// Sentence returns a pseudo-random short sentence.
func Sentence() string {
	words := make([]string, 0, 6)
	count := 4 + rand.Intn(3)
	for i := 0; i < count; i++ {
		words = append(words, randomFrom(sentenceWords))
	}
	return strings.Title(strings.Join(words, " ")) + "."
}

func randomDigits(n int) string {
	runes := make([]rune, n)
	for i := 0; i < n; i++ {
		runes[i] = rune('0' + rand.Intn(10))
	}
	return string(runes)
}
