import { Star } from "lucide-react";

type StarRatingInputProps = {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
  label?: string;
};

export function StarRatingInput({
  value,
  onChange,
  disabled = false,
  label = "Rating",
}: StarRatingInputProps) {
  return (
    <div>
      <p className="text-sm text-label">{label}</p>
      <div
        className="mt-1 flex gap-1"
        role="radiogroup"
        aria-label={label}
      >
        {[1, 2, 3, 4, 5].map((rating) => {
          const selected = rating <= value;

          return (
            <button
              key={rating}
              type="button"
              role="radio"
              aria-checked={value === rating}
              aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
              disabled={disabled}
              onClick={() => onChange(rating)}
              className={[
                "rounded-md p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                selected
                  ? "text-accent"
                  : "text-gray-300 hover:text-accent/70",
              ].join(" ")}
            >
              <Star
                className="h-7 w-7"
                fill={selected ? "currentColor" : "none"}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StarRatingDisplay({
  rating,
  className = "",
}: {
  rating: number;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-0.5 ${className}`}
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={[
            "h-4 w-4",
            star <= rating ? "text-accent" : "text-gray-300",
          ].join(" ")}
          fill={star <= rating ? "currentColor" : "none"}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
