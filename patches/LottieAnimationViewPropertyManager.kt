textFilters?.let { filters ->
    if (filters.size() > 0) {
        val textDelegate = TextDelegate(view)
        val textFiltersArray = filters as? ReadableArray
        if (textFiltersArray != null) {
            for (i in 0 until textFiltersArray.size()) {
                val current = textFiltersArray.getMap(i)
                if (current != null) {
                    val searchText = current.getString("find")
                    val replacementText = current.getString("replace")
                    textDelegate.setText(searchText, replacementText)
                }
            }
        }
        view.setTextDelegate(textDelegate)
    }
}

<!-- /////////////////////////////////// -->

colorFilters?.let { colorFilters ->
    if (colorFilters.size() > 0) {
        for (i in 0 until colorFilters.size()) {
                val current = colorFilters.getMap(i)
                if (current != null) {
                parseColorFilter(current, view)
            }
        }
    }
}
