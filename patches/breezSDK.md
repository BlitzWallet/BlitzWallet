for each line
else -> throw SdkException.Generic(errUnexpectedType("${value::class.java.name}"))
needs to be changed to 
else -> throw SdkException.Generic(errUnexpectedType("${value!!::class.java.name}"))
