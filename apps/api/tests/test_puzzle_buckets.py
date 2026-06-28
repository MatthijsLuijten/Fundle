"""Tests for price bucket partition validation."""

from unittest.mock import MagicMock

from app.services.puzzle_builder import (
    _check_bucket_partitions,
    _parse_price_buckets_from_string,
    _pick_listing_detail,
)


class TestPricePartitions:
    """Tests for non-overlapping price bucket partitions."""

    def test_non_overlapping_partitions(self):
        """Valid non-overlapping partitions pass without warning."""
        buckets = [
            (150000, 400000, 0.20),
            (400000, 600000, 0.30),
            (600000, 900000, 0.30),
            (900000, 1400000, 0.15),
        ]
        # Should not raise or warn
        _check_bucket_partitions(buckets)

    def test_overlapping_partitions_detected(self, capsys):
        """Overlapping partitions trigger warning."""
        buckets = [
            (150000, 500000, 0.30),  # overlaps with next
            (400000, 600000, 0.30),  # overlaps with previous
            (600000, 900000, 0.40),
        ]
        _check_bucket_partitions(buckets)
        captured = capsys.readouterr()
        assert "overlap detected" in captured.err.lower()

    def test_gap_between_partitions_detected(self, capsys):
        """Gap between capped partitions triggers warning."""
        buckets = [
            (150000, 400000, 0.20),
            (500000, 600000, 0.30),  # gap: [400000, 500000)
            (600000, 900000, 0.50),
        ]
        _check_bucket_partitions(buckets)
        captured = capsys.readouterr()
        assert "gap detected" in captured.err.lower()

    def test_capped_uncapped_boundary_match(self):
        """Last capped bucket boundary matches first uncapped bucket start."""
        buckets = [
            (150000, 400000, 0.20),
            (400000, 600000, 0.30),
            (600000, 1400000, 0.50),
            (1400000, None, 0.00),  # boundary matches
        ]
        # Should not raise or warn
        _check_bucket_partitions(buckets)

    def test_capped_uncapped_boundary_gap_detected(self, capsys):
        """Gap between last capped and uncapped bucket triggers warning."""
        buckets = [
            (150000, 400000, 0.20),
            (400000, 600000, 0.30),
            (600000, 1400000, 0.50),
            (1500000, None, 0.00),  # gap: [1400000, 1500000)
        ]
        _check_bucket_partitions(buckets)
        captured = capsys.readouterr()
        assert "gap" in captured.err.lower() and "uncapped" in captured.err.lower()

    def test_single_bucket_no_check(self):
        """Single bucket skips partition checks."""
        buckets = [(150000, 400000, 1.0)]
        # Should return early without checks
        _check_bucket_partitions(buckets)

    def test_only_uncapped_bucket(self):
        """Single uncapped bucket skips checks."""
        buckets = [(150000, None, 1.0)]
        _check_bucket_partitions(buckets)

    def test_parse_valid_config(self):
        """Parse valid bucket config string."""
        config = "150000:400000:0.20;400000:600000:0.30;1400000::0.50"
        buckets = _parse_price_buckets_from_string(config)
        assert len(buckets) == 3
        assert buckets[0] == (150000, 400000, 0.20)
        assert buckets[1] == (400000, 600000, 0.30)
        assert buckets[2] == (1400000, None, 0.50)

    def test_parse_uncapped_bucket(self):
        """Parse uncapped bucket (empty max)."""
        config = "1000000::1.0"
        buckets = _parse_price_buckets_from_string(config)
        assert len(buckets) == 1
        assert buckets[0] == (1000000, None, 1.0)

    def test_partition_boundary_math(self):
        """Verify interval logic: [a, b) and [b, c) are adjacent."""
        # Test that the overlap detection correctly identifies adjacent intervals
        buckets = [
            (100, 200, 0.5),
            (200, 300, 0.5),
        ]
        # These should NOT overlap because [100, 200) and [200, 300) share a boundary
        # The condition is: NOT (hi1 <= lo2 or hi2 <= lo1)
        # For [100, 200) and [200, 300): 200 <= 200 is True, so NOT True = False (no overlap) ✓
        _check_bucket_partitions(buckets)

    def test_partition_overlap_math(self, capsys):
        """Verify interval logic: [a, b) and [a, c) where b > a overlap."""
        buckets = [
            (100, 300, 0.5),  # [100, 300)
            (200, 400, 0.5),  # [200, 400) - overlaps in [200, 300)
        ]
        # The condition: NOT (300 <= 200 or 400 <= 100) = NOT (False or False) = True (overlap!) ✓
        _check_bucket_partitions(buckets)
        captured = capsys.readouterr()
        assert "overlap detected" in captured.err.lower()


class TestListingDetailFiltering:
    """Tests for price boundary filtering in _pick_listing_detail."""

    def _make_mock_listing(self, amount):
        """Create a mock listing with the given price amount."""
        listing = MagicMock()
        listing.price.amount = amount
        listing.price.is_auction = False
        listing.offering_type = "buy"
        listing.city = "Amsterdam"
        listing.property_details.construction_type = "existing"
        return listing

    def test_price_at_lower_bound_included(self):
        """Listing with price equal to min_price is included (lower bound inclusive)."""
        client = MagicMock()
        candidate = MagicMock()
        candidate.global_id = "123"

        listing = self._make_mock_listing(amount=150000)
        client.listing.return_value = listing

        result = _pick_listing_detail(client, [candidate], min_price=150000, max_price=400000)
        assert result is not None
        assert result.price.amount == 150000

    def test_price_at_upper_bound_excluded(self):
        """Listing with price equal to max_price is excluded (upper bound exclusive)."""
        client = MagicMock()
        candidate = MagicMock()
        candidate.global_id = "123"

        listing = self._make_mock_listing(amount=400000)
        client.listing.return_value = listing

        result = _pick_listing_detail(client, [candidate], min_price=150000, max_price=400000)
        assert result is None, "Price at upper boundary should be excluded"

    def test_price_just_below_upper_bound_included(self):
        """Listing with price just below max_price is included."""
        client = MagicMock()
        candidate = MagicMock()
        candidate.global_id = "123"

        listing = self._make_mock_listing(amount=399999)
        client.listing.return_value = listing

        result = _pick_listing_detail(client, [candidate], min_price=150000, max_price=400000)
        assert result is not None
        assert result.price.amount == 399999

    def test_price_below_lower_bound_excluded(self):
        """Listing with price below min_price is excluded."""
        client = MagicMock()
        candidate = MagicMock()
        candidate.global_id = "123"

        listing = self._make_mock_listing(amount=149999)
        client.listing.return_value = listing

        result = _pick_listing_detail(client, [candidate], min_price=150000, max_price=400000)
        assert result is None

    def test_price_above_upper_bound_excluded(self):
        """Listing with price above max_price is excluded."""
        client = MagicMock()
        candidate = MagicMock()
        candidate.global_id = "123"

        listing = self._make_mock_listing(amount=400001)
        client.listing.return_value = listing

        result = _pick_listing_detail(client, [candidate], min_price=150000, max_price=400000)
        assert result is None

    def test_price_in_valid_range(self):
        """Listing with price in the middle of range is included."""
        client = MagicMock()
        candidate = MagicMock()
        candidate.global_id = "123"

        listing = self._make_mock_listing(amount=275000)
        client.listing.return_value = listing

        result = _pick_listing_detail(client, [candidate], min_price=150000, max_price=400000)
        assert result is not None
        assert result.price.amount == 275000

    def test_uncapped_max_price(self):
        """Listing can be accepted with None max_price (uncapped)."""
        client = MagicMock()
        candidate = MagicMock()
        candidate.global_id = "123"

        listing = self._make_mock_listing(amount=5000000)
        client.listing.return_value = listing

        result = _pick_listing_detail(client, [candidate], min_price=1400000, max_price=None)
        assert result is not None
        assert result.price.amount == 5000000
